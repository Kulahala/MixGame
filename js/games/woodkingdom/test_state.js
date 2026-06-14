import assert from 'assert';
import { WoodKingdomState, CARD_TYPES } from './state.js';

function runTest(name, fn) {
  try {
    fn();
    console.log(`\x1b[32m✔ PASS: ${name}\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m✘ FAIL: ${name}\x1b[0m`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Running Wood Kingdom State Engine Unit Tests...\n');

// 1. Test Card Playing, Sacrificing, and Drawing
runTest('Playing, sacrificing, and drawing cards', () => {
  const state = new WoodKingdomState(1);
  
  // Test initial setup
  assert.strictEqual(state.playerSlots.every(s => s === null), true);
  assert.strictEqual(state.opponentSlots.every(s => s === null), true);
  assert.strictEqual(state.resources.raindrop, 0);
  assert.strictEqual(state.resources.wood, 0);
  
  // Draw basic resource cards
  const squirrel = state.drawCard('squirrel');
  assert.strictEqual(squirrel.id, 'squirrel');
  assert.strictEqual(state.hand.includes(squirrel), true);
  
  const sprout = state.drawCard('sprout');
  assert.strictEqual(sprout.id, 'sprout');
  assert.strictEqual(state.hand.includes(sprout), true);

  // Play squirrel to slot 0
  state.playCard('squirrel', 0);
  assert.strictEqual(state.playerSlots[0].id, 'squirrel');
  assert.strictEqual(state.hand.includes(squirrel), false);

  // Sacrifice squirrel at slot 0
  const sacResult = state.sacrificeCard(0);
  assert.strictEqual(state.playerSlots[0], null);
  assert.strictEqual(sacResult.card.id, 'squirrel');
  assert.strictEqual(state.resources.wood, 1);
  assert.strictEqual(state.resources.raindrop, 0);

  // Play sprout to slot 1
  state.playCard('sprout', 1);
  assert.strictEqual(state.playerSlots[1].id, 'sprout');
  
  // Sacrifice sprout at slot 1
  state.sacrificeCard(1);
  assert.strictEqual(state.playerSlots[1], null);
  assert.strictEqual(state.resources.raindrop, 1);
  assert.strictEqual(state.resources.wood, 1);
});

// 2. Test Resource Updates and Playing Costly Cards
runTest('Resource updates and playing costs', () => {
  const state = new WoodKingdomState(1);
  
  // Add resources manually to check costs
  state.resources.raindrop = 1;
  state.resources.wood = 2;
  
  // Find a sapling in hand or deck, add it to hand
  const sapling = state.createCard('sapling');
  state.hand.push(sapling);

  // Play sapling (costs 1 raindrop)
  state.playCard(sapling.instanceId, 0);
  assert.strictEqual(state.playerSlots[0].instanceId, sapling.instanceId);
  assert.strictEqual(state.resources.raindrop, 0);
  assert.strictEqual(state.resources.wood, 2);

  // Try to play oak (costs 2 wood)
  const oak = state.createCard('oak');
  state.hand.push(oak);
  state.playCard(oak.instanceId, 1);
  assert.strictEqual(state.playerSlots[1].instanceId, oak.instanceId);
  assert.strictEqual(state.resources.wood, 0);

  // Verify failure when playing without enough resources
  const bird = state.createCard('bird'); // costs 1 raindrop
  state.hand.push(bird);
  assert.throws(() => {
    state.playCard(bird.instanceId, 2);
  }, /Not enough resources/);
});

// 3. Test Airborne Sigil
runTest('Airborne Sigil (bypass opponent card and hit scale)', () => {
  const state = new WoodKingdomState(1);
  state.opponentQueue.fill(null);
  
  // Disable Opponent AI to test combat in isolation
  state.runOpponentAI = () => {};

  // Place player bird (airborne, attack 1) in slot 0
  const bird = state.createCard('bird');
  state.playerSlots[0] = bird;

  // Place opponent sapling (hp 2) in slot 0
  const opponentSapling = state.createCard('sapling');
  state.opponentSlots[0] = opponentSapling;

  // Resolve turn
  state.resolveTurn();

  // Scale tilt should increase by 1 because bird has Airborne
  assert.strictEqual(state.scaleTilt, 1);
  // Opponent sapling HP should remain untouched (2)
  assert.strictEqual(opponentSapling.hp, 2);
});

// 4. Test Bifurcated Sigil
runTest('Bifurcated Sigil (diagonal attacks)', () => {
  const state = new WoodKingdomState(1);
  state.opponentQueue.fill(null);
  state.runOpponentAI = () => {};

  // Place player bifurcated pine (bifurcated, attack 1) in slot 1
  const bifurcatedPine = state.createCard('bifurcated_pine');
  state.playerSlots[1] = bifurcatedPine;

  // Place opponent cards at slot 0 and slot 2 — use nut_shield (0 attack, HP 4)
  // so their counterattacks won't affect scaleTilt
  const opponentShield0 = state.createCard('nut_shield'); // HP 4, attack 0
  opponentShield0.shieldActive = false; // disable shield to test raw HP damage
  const opponentShield2 = state.createCard('nut_shield'); // HP 4, attack 0
  opponentShield2.shieldActive = false;
  state.opponentSlots[0] = opponentShield0;
  state.opponentSlots[2] = opponentShield2;
  // slot 1 is empty on opponent side

  state.resolveTurn();

  // Player bifurcated pine at 1 should attack diagonal slots 0 and 2.
  // Both opponent cards should take 1 damage.
  assert.strictEqual(opponentShield0.hp, 3);
  assert.strictEqual(opponentShield2.hp, 3);
  // Direct scale tilt should be 0 because both target slots were blocked by cards
  // and opponent cards have 0 attack so no counterattack
  assert.strictEqual(state.scaleTilt, 0);

  // Now clear slot 2 and attack again
  state.opponentSlots[2] = null;
  state.resolveTurn();

  // opponentShield0 takes another 1 damage, HP becomes 2
  assert.strictEqual(opponentShield0.hp, 2);
  
  // Slot 2 is empty, so player's bifurcated pine hits scale directly (scaleTilt + 1)
  assert.strictEqual(state.scaleTilt, 1);
});

// 5. Test Deathtouch Sigil & Card Destruction Resources
runTest('Deathtouch Sigil and destruction resource gains', () => {
  const state = new WoodKingdomState(1);
  state.opponentQueue.fill(null);
  state.runOpponentAI = () => {};

  // Player mushroom (deathtouch, attack 1) in slot 0
  const mushroom = state.createCard('deathtouch_mushroom');
  state.playerSlots[0] = mushroom;

  // Opponent oak (HP 5) in slot 0
  const oak = state.createCard('oak');
  state.opponentSlots[0] = oak;

  assert.strictEqual(state.resources.leaves, 0);

  state.resolveTurn();

  // Oak HP should instantly become 0 and slot 0 should be cleared
  assert.strictEqual(state.opponentSlots[0], null);
  // Player should receive 1 Leaves (since opponent card was destroyed)
  // Let's verify our custom resource rules: oak has deathReward.leaves which defaults to 1 if not specified,
  // or +1 Leaves because it's an opponent card. Let's make sure it's at least 1.
  assert.ok(state.resources.leaves >= 1);
});

// 6. Test Shield Sigil
runTest('Shield Sigil (blocks first damage event)', () => {
  const state = new WoodKingdomState(1);
  state.opponentQueue.fill(null);
  state.runOpponentAI = () => {};

  // Player sapling (attack 1) in slot 0
  const sapling = state.createCard('sapling');
  state.playerSlots[0] = sapling;

  // Opponent nut shield (shield, HP 4) in slot 0
  const nutShield = state.createCard('nut_shield');
  state.opponentSlots[0] = nutShield;

  assert.strictEqual(nutShield.shieldActive, true);

  // Turn 1 resolve: sapling attacks nut shield, shield absorbs it
  state.resolveTurn();
  
  assert.strictEqual(nutShield.shieldActive, false);
  assert.strictEqual(nutShield.hp, 4); // No HP lost

  // Turn 2 resolve: sapling attacks again, shield is down, takes 1 damage
  state.resolveTurn();

  assert.strictEqual(nutShield.hp, 3); // 1 HP lost
});

// 7. Test Scale Tilt, Win and Loss Conditions
runTest('Scale tilt win and loss conditions', () => {
  const state = new WoodKingdomState(1);
  state.opponentQueue.fill(null);
  state.runOpponentAI = () => {};

  // Test win condition (scale tilt >= 5)
  state.scaleTilt = 4;
  const bird = state.createCard('bird'); // attack 1
  state.playerSlots[0] = bird;
  
  let log = state.resolveTurn();
  assert.strictEqual(state.scaleTilt, 5);
  assert.strictEqual(state.isGameOver().finished, true);
  assert.strictEqual(state.isGameOver().won, true);
  
  // Test loss condition (scale tilt <= -5)
  const state2 = new WoodKingdomState(1);
  state2.opponentQueue.fill(null);
  state2.runOpponentAI = () => {};
  state2.scaleTilt = -4;
  
  const opponentSapling = state2.createCard('sapling'); // attack 1
  state2.opponentSlots[0] = opponentSapling;
  
  state2.resolveTurn();
  assert.strictEqual(state2.scaleTilt, -5);
  assert.strictEqual(state2.isGameOver().finished, true);
  assert.strictEqual(state2.isGameOver().won, false);
});

// 8. Test Opponent Queue and Advancement
runTest('Opponent queue placement and advancement', () => {
  const state = new WoodKingdomState(1);
  state.opponentQueue.fill(null);
  state.runOpponentAI = () => {}; // Disable AI to control manually
  
  // Manually place card in opponent queue at slot 1
  const sapling = state.createCard('sapling');
  state.opponentQueue[1] = sapling;
  assert.strictEqual(state.opponentSlots[1], null);
  
  // Resolve turn - should advance queue to slot 1
  state.resolveTurn();
  
  assert.strictEqual(state.opponentSlots[1].instanceId, sapling.instanceId);
  assert.strictEqual(state.opponentQueue[1], null);
  
  // Place another card in queue slot 1 while slot 1 is occupied
  const squirrel = state.createCard('squirrel');
  state.opponentQueue[1] = squirrel;
  
  state.resolveTurn();
  
  // frontline slot 1 remains sapling, queue slot 1 remains squirrel
  assert.strictEqual(state.opponentSlots[1].instanceId, sapling.instanceId);
  assert.strictEqual(state.opponentQueue[1].instanceId, squirrel.instanceId);
});

console.log('\nAll Wood Kingdom State Engine Unit Tests Passed successfully!');
