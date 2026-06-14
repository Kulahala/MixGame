import { getScores } from '../../core/storage.js';

export const CARD_TYPES = {
  squirrel: {
    id: 'squirrel',
    name: '松鼠',
    maxHp: 1,
    hp: 1,
    attack: 0,
    cost: { raindrop: 0, wood: 0, acorn: 0, leaves: 0 },
    sigils: [],
    sacrificeReward: { wood: 1 },
    deathReward: { acorn: 1 }
  },
  sprout: {
    id: 'sprout',
    name: '嫩芽',
    maxHp: 1,
    hp: 1,
    attack: 0,
    cost: { raindrop: 0, wood: 0, acorn: 0, leaves: 0 },
    sigils: [],
    sacrificeReward: { raindrop: 1 },
    deathReward: { acorn: 1 }
  },
  sapling: {
    id: 'sapling',
    name: '小树苗',
    maxHp: 2,
    hp: 2,
    attack: 1,
    cost: { raindrop: 1, wood: 0, acorn: 0, leaves: 0 },
    sigils: [],
    sacrificeReward: { wood: 1 },
    deathReward: { acorn: 1 }
  },
  oak: {
    id: 'oak',
    name: '橡树',
    maxHp: 5,
    hp: 5,
    attack: 1,
    cost: { raindrop: 0, wood: 2, acorn: 0, leaves: 0 },
    sigils: [],
    sacrificeReward: { wood: 2 },
    deathReward: { acorn: 2 }
  },
  bird: {
    id: 'bird',
    name: '小鸟',
    maxHp: 1,
    hp: 1,
    attack: 1,
    cost: { raindrop: 1, wood: 0, acorn: 0, leaves: 0 },
    sigils: ['airborne'],
    sacrificeReward: { raindrop: 1 },
    deathReward: { acorn: 1 }
  },
  bifurcated_pine: {
    id: 'bifurcated_pine',
    name: '分叉松',
    maxHp: 3,
    hp: 3,
    attack: 1,
    cost: { raindrop: 0, wood: 2, acorn: 0, leaves: 0 },
    sigils: ['bifurcated'],
    sacrificeReward: { wood: 2 },
    deathReward: { acorn: 1 }
  },
  deathtouch_mushroom: {
    id: 'deathtouch_mushroom',
    name: '剧毒菇',
    maxHp: 1,
    hp: 1,
    attack: 1,
    cost: { raindrop: 1, wood: 1, acorn: 0, leaves: 0 },
    sigils: ['deathtouch'],
    sacrificeReward: { raindrop: 1 },
    deathReward: { acorn: 1 }
  },
  nut_shield: {
    id: 'nut_shield',
    name: '坚果盾',
    maxHp: 4,
    hp: 4,
    attack: 0,
    cost: { raindrop: 0, wood: 0, acorn: 1, leaves: 0 },
    sigils: ['shield'],
    sacrificeReward: { wood: 1 },
    deathReward: { acorn: 1 }
  },
  grove_guardian: {
    id: 'grove_guardian',
    name: '森之卫',
    maxHp: 5,
    hp: 5,
    attack: 2,
    cost: { raindrop: 0, wood: 3, acorn: 0, leaves: 0 },
    sigils: [],
    sacrificeReward: { wood: 2 },
    deathReward: { acorn: 2 }
  }
};

export class WoodKingdomState {
  constructor(level = 1) {
    this.level = level;
    this.resources = { raindrop: 0, wood: 0, leaves: 0, acorn: 0 };
    this.playerSlots = [null, null, null, null];
    this.opponentSlots = [null, null, null, null];
    this.hand = [];
    this.deck = [];
    this.scaleTilt = 0;
    this.turn = 1;
    this.initDeck();
  }

  initDeck() {
    const defaultDeckIds = [
      'sapling', 'sapling', 'bird', 'oak',
      'bifurcated_pine', 'deathtouch_mushroom',
      'nut_shield', 'grove_guardian'
    ];
    this.deck = defaultDeckIds.map(id => this.createCard(id));
    // Simple shuffle
    this.deck.sort(() => Math.random() - 0.5);

    // Initial draw
    for (let i = 0; i < 3; i++) {
      if (this.deck.length > 0) {
        this.hand.push(this.deck.shift());
      }
    }
  }

  createCard(id) {
    const template = CARD_TYPES[id];
    if (!template) {
      throw new Error(`Unknown card type: ${id}`);
    }
    const card = {
      ...template,
      sigils: [...template.sigils],
      cost: {
        raindrop: 0,
        wood: 0,
        acorn: 0,
        leaves: 0,
        ...template.cost
      },
      hp: template.maxHp,
      instanceId: Math.random().toString(36).substring(2, 11)
    };
    card.shieldActive = card.sigils.includes('shield');
    return card;
  }

  reset() {
    this.resources = { raindrop: 0, wood: 0, leaves: 0, acorn: 0 };
    this.playerSlots = [null, null, null, null];
    this.opponentSlots = [null, null, null, null];
    this.hand = [];
    this.deck = [];
    this.scaleTilt = 0;
    this.turn = 1;
    this.initDeck();
  }

  nextLevel() {
    this.level++;
    this.reset();
    return this.level;
  }

  getBestTime() {
    try {
      const scores = getScores();
      const woodkingdomScore = scores.woodkingdom;
      return woodkingdomScore ? (woodkingdomScore.bestTime || 0) : 0;
    } catch (e) {
      return 0;
    }
  }

  sacrificeCard(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 4) {
      throw new Error('Invalid slot index');
    }
    const card = this.playerSlots[slotIndex];
    if (!card) {
      throw new Error('No card to sacrifice at this slot');
    }

    const reward = card.sacrificeReward || {};
    const raindropGain = reward.raindrop || 0;
    const woodGain = reward.wood || 0;
    const acornGain = reward.acorn || 0;
    const leavesGain = reward.leaves || 0;

    this.resources.raindrop += raindropGain;
    this.resources.wood += woodGain;
    this.resources.acorn += acornGain;
    this.resources.leaves += leavesGain;

    this.playerSlots[slotIndex] = null;

    return {
      card,
      gained: { raindrop: raindropGain, wood: woodGain, acorn: acornGain, leaves: leavesGain }
    };
  }

  playCard(cardId, slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 4) {
      throw new Error('Invalid slot index');
    }
    if (this.playerSlots[slotIndex] !== null) {
      throw new Error('Slot is already occupied');
    }

    let cardIndex = -1;
    if (typeof cardId === 'number') {
      if (cardId >= 0 && cardId < this.hand.length) {
        cardIndex = cardId;
      }
    } else {
      cardIndex = this.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
    }

    if (cardIndex === -1) {
      throw new Error(`Card not found in hand: ${cardId}`);
    }

    const card = this.hand[cardIndex];
    const cost = card.cost || {};
    const raindropCost = cost.raindrop || 0;
    const woodCost = cost.wood || 0;
    const acornCost = cost.acorn || 0;
    const leavesCost = cost.leaves || 0;

    if (this.resources.raindrop < raindropCost ||
        this.resources.wood < woodCost ||
        this.resources.acorn < acornCost ||
        this.resources.leaves < leavesCost) {
      throw new Error('Not enough resources to play this card');
    }

    this.resources.raindrop -= raindropCost;
    this.resources.wood -= woodCost;
    this.resources.acorn -= acornCost;
    this.resources.leaves -= leavesCost;

    this.playerSlots[slotIndex] = card;
    this.hand.splice(cardIndex, 1);

    return card;
  }

  drawCard(type) {
    if (this.hand.length >= 6) {
      return null;
    }
    let card;
    if (type === 'squirrel') {
      card = this.createCard('squirrel');
      this.hand.push(card);
    } else if (type === 'sprout') {
      card = this.createCard('sprout');
      this.hand.push(card);
    } else if (type === 'deck') {
      if (this.deck.length === 0) {
        return null;
      }
      card = this.deck.shift();
      this.hand.push(card);
    } else {
      throw new Error(`Unknown draw type: ${type}`);
    }
    return card;
  }

  isGameOver() {
    if (this.scaleTilt >= 5) {
      return { finished: true, won: true };
    } else if (this.scaleTilt <= -5) {
      return { finished: true, won: false };
    }
    return { finished: false, won: false };
  }

  runOpponentAI(log) {
    const level = this.level || 1;
    let placementProbability = 0.4;
    let cardPool = ['squirrel', 'sprout', 'sapling'];

    if (level === 2) {
      placementProbability = 0.6;
      cardPool = ['sapling', 'bird', 'bifurcated_pine', 'nut_shield'];
    } else if (level >= 3) {
      placementProbability = 0.8;
      cardPool = ['oak', 'bifurcated_pine', 'deathtouch_mushroom', 'grove_guardian'];
    }

    for (let i = 0; i < 4; i++) {
      if (this.opponentSlots[i] === null) {
        if (Math.random() < placementProbability) {
          const randomIndex = Math.floor(Math.random() * cardPool.length);
          const cardId = cardPool[randomIndex];
          const card = this.createCard(cardId);

          this.opponentSlots[i] = card;

          log.push({
            type: 'opponent_play',
            slotIndex: i,
            card: { ...card }
          });
        }
      }
    }
  }

  resolveTurn() {
    const log = [];

    // 1. Opponent AI plays cards
    this.runOpponentAI(log);

    // 2. Combat Resolution left to right (slots 0 to 3)
    for (let i = 0; i < 4; i++) {
      if (this.isGameOver().finished) {
        break;
      }

      // Player attacks
      const playerCard = this.playerSlots[i];
      if (playerCard && playerCard.hp > 0 && playerCard.attack > 0) {
        this.resolveCardAttack('player', i, playerCard, log);
      }

      if (this.isGameOver().finished) {
        break;
      }

      // Opponent attacks
      const opponentCard = this.opponentSlots[i];
      if (opponentCard && opponentCard.hp > 0 && opponentCard.attack > 0) {
        this.resolveCardAttack('opponent', i, opponentCard, log);
      }
    }

    this.turn++;

    const gameOverState = this.isGameOver();
    if (gameOverState.finished) {
      log.push({
        type: 'game_over',
        won: gameOverState.won,
        scaleTilt: this.scaleTilt
      });
    }

    return log;
  }

  resolveCardAttack(attackerSide, fromIdx, card, log) {
    let targetIndices = [];
    if (card.sigils.includes('bifurcated')) {
      targetIndices = [fromIdx - 1, fromIdx + 1];
    } else {
      targetIndices = [fromIdx];
    }

    for (const targetIdx of targetIndices) {
      if (targetIdx < 0 || targetIdx >= 4) {
        continue;
      }
      if (this.isGameOver().finished) {
        break;
      }
      this.executeSingleAttack(attackerSide, fromIdx, targetIdx, card, log);
    }
  }

  executeSingleAttack(attackerSide, fromIdx, targetIdx, card, log) {
    const targetSide = attackerSide === 'player' ? 'opponent' : 'player';
    const targetSlots = targetSide === 'player' ? this.playerSlots : this.opponentSlots;
    const targetCard = targetSlots[targetIdx];
    const dmg = card.attack;
    const isAirborne = card.sigils.includes('airborne');

    if (!targetCard || isAirborne) {
      // Direct hit to scale
      if (attackerSide === 'player') {
        this.scaleTilt += dmg;
      } else {
        this.scaleTilt -= dmg;
      }
      this.scaleTilt = Math.max(-5, Math.min(5, this.scaleTilt));

      log.push({
        type: 'combat_attack',
        attackerSide,
        fromSlot: fromIdx,
        targetSlot: targetIdx,
        damage: dmg,
        direct: true,
        scaleTilt: this.scaleTilt
      });
    } else {
      // Hit card
      if (targetCard.shieldActive) {
        targetCard.shieldActive = false;
        log.push({
          type: 'shield_break',
          side: targetSide,
          slotIndex: targetIdx,
          card: { ...targetCard }
        });
        log.push({
          type: 'combat_attack',
          attackerSide,
          fromSlot: fromIdx,
          targetSlot: targetIdx,
          damage: 0,
          blocked: true,
          targetCard: { ...targetCard }
        });
      } else {
        targetCard.hp -= dmg;
        log.push({
          type: 'combat_attack',
          attackerSide,
          fromSlot: fromIdx,
          targetSlot: targetIdx,
          damage: dmg,
          direct: false,
          targetCard: { ...targetCard }
        });

        if (card.sigils.includes('deathtouch') && dmg > 0 && targetCard.hp > 0) {
          targetCard.hp = 0;
          log.push({
            type: 'deathtouch_trigger',
            side: targetSide,
            slotIndex: targetIdx,
            card: { ...targetCard }
          });
        }

        if (targetCard.hp <= 0) {
          targetSlots[targetIdx] = null;
          log.push({
            type: 'card_death',
            side: targetSide,
            slotIndex: targetIdx,
            card: { ...targetCard }
          });

          if (targetSide === 'player') {
            const acornGain = (targetCard.deathReward && targetCard.deathReward.acorn !== undefined) ? targetCard.deathReward.acorn : 1;
            this.resources.acorn += acornGain;
            log.push({
              type: 'resource_gain',
              resource: 'acorn',
              amount: acornGain
            });
          } else {
            const leavesGain = (targetCard.deathReward && targetCard.deathReward.leaves !== undefined) ? targetCard.deathReward.leaves : 1;
            this.resources.leaves += leavesGain;
            log.push({
              type: 'resource_gain',
              resource: 'leaves',
              amount: leavesGain
            });
          }
        }
      }
    }
  }
}
