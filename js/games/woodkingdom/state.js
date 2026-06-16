import { getScores } from '../../core/storage.js';

export const CARD_TYPES = {
  squirrel: {
    id: 'squirrel',
    name: '松鼠',
    maxHp: 1,
    hp: 1,
    attack: 0,
    cost: { dewdrop: 0, leaf: 0 },
    sigils: [],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  sprout: {
    id: 'sprout',
    name: '嫩芽',
    maxHp: 1,
    hp: 1,
    attack: 0,
    cost: { dewdrop: 0, leaf: 0 },
    sigils: [],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  sapling: {
    id: 'sapling',
    name: '小树苗',
    maxHp: 2,
    hp: 2,
    attack: 1,
    cost: { dewdrop: 1, leaf: 0 },
    sigils: [],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  oak: {
    id: 'oak',
    name: '橡树',
    maxHp: 5,
    hp: 5,
    attack: 1,
    cost: { dewdrop: 2, leaf: 0 },
    sigils: [],
    releaseReward: { dewdrop: 2 },
    leaveReward: { leaf: 2 }
  },
  bird: {
    id: 'bird',
    name: '小鸟',
    maxHp: 1,
    hp: 1,
    attack: 1,
    cost: { dewdrop: 1, leaf: 0 },
    sigils: ['airborne'],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  bifurcated_pine: {
    id: 'bifurcated_pine',
    name: '分叉松',
    maxHp: 3,
    hp: 3,
    attack: 1,
    cost: { dewdrop: 2, leaf: 0 },
    sigils: ['bifurcated'],
    releaseReward: { dewdrop: 2 },
    leaveReward: { leaf: 1 }
  },
  deathtouch_mushroom: {
    id: 'deathtouch_mushroom',
    name: '催眠菇',
    maxHp: 1,
    hp: 1,
    attack: 1,
    cost: { dewdrop: 1, leaf: 1 },
    sigils: ['sleepTouch'],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  nut_shield: {
    id: 'nut_shield',
    name: '坚果盾',
    maxHp: 4,
    hp: 4,
    attack: 0,
    cost: { dewdrop: 0, leaf: 1 },
    sigils: ['shield'],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  grove_guardian: {
    id: 'grove_guardian',
    name: '森之卫',
    maxHp: 5,
    hp: 5,
    attack: 2,
    cost: { dewdrop: 3, leaf: 0 },
    sigils: [],
    releaseReward: { dewdrop: 2 },
    leaveReward: { leaf: 2 }
  },
  moss_turtle: {
    id: 'moss_turtle',
    name: '苔藓龟',
    maxHp: 3,
    hp: 3,
    attack: 1,
    cost: { dewdrop: 2, leaf: 0 },
    sigils: ['unkillable'],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  elder_deer: {
    id: 'elder_deer',
    name: '长老鹿',
    maxHp: 4,
    hp: 4,
    attack: 2,
    cost: { dewdrop: 2, leaf: 1 },
    sigils: ['leader'],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  },
  baby_owl: {
    id: 'baby_owl',
    name: '猫头鹰雏',
    maxHp: 1,
    hp: 1,
    attack: 1,
    cost: { dewdrop: 1, leaf: 0 },
    sigils: ['fledgling'],
    releaseReward: { dewdrop: 1 },
    leaveReward: { leaf: 1 }
  }
};

export class WoodKingdomState {
  constructor(level = 1) {
    this.level = level;
    this.resources = { dewdrop: 0, leaf: 0 };
    this.playerSlots = [null, null, null, null];
    this.opponentSlots = [null, null, null, null];
    this.opponentQueue = [null, null, null, null];
    this.hand = [];
    this.deck = [];
    this.scaleTilt = 0;
    this.turn = 1;
    this.initDeck();
    this.runOpponentAI([]);
  }

  initDeck() {
    const defaultDeckIds = [
      'sapling', 'baby_owl', 'bird', 'oak',
      'bifurcated_pine', 'deathtouch_mushroom',
      'nut_shield', 'grove_guardian'
    ];
    this.deck = defaultDeckIds.map(id => this.createCard(id));
    // Fisher-Yates shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }

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
        dewdrop: 0,
        leaf: 0,
        ...template.cost
      },
      hp: template.maxHp,
      instanceId: Math.random().toString(36).substring(2, 11),
      turnsAlive: 0
    };
    card.shieldActive = card.sigils.includes('shield');
    return card;
  }

  reset() {
    this.resources = { dewdrop: 0, leaf: 0 };
    this.playerSlots = [null, null, null, null];
    this.opponentSlots = [null, null, null, null];
    this.opponentQueue = [null, null, null, null];
    this.hand = [];
    this.deck = [];
    this.scaleTilt = 0;
    this.turn = 1;
    this.initDeck();
    this.runOpponentAI([]);
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

  releaseCard(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 4) {
      throw new Error('Invalid slot index');
    }
    const card = this.playerSlots[slotIndex];
    if (!card) {
      throw new Error('No card to release at this slot');
    }

    const releaseReward = card.releaseReward || {};
    const dewdropGain = releaseReward.dewdrop || 0;
    
    const leaveReward = card.leaveReward || {};
    const leafGain = leaveReward.leaf || 0;

    this.resources.dewdrop += dewdropGain;
    this.resources.leaf += leafGain;

    this.playerSlots[slotIndex] = null;

    if (card.sigils.includes('unkillable')) {
      this.hand.push(this.createCard(card.id));
    }

    return {
      card,
      gained: { dewdrop: dewdropGain, leaf: leafGain }
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
    const dewdropCost = cost.dewdrop || 0;
    const leafCost = cost.leaf || 0;

    if (this.resources.dewdrop < dewdropCost || this.resources.leaf < leafCost) {
      throw new Error('Not enough resources to play this card');
    }

    this.resources.dewdrop -= dewdropCost;
    this.resources.leaf -= leafCost;

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

    if (level === 1) {
      cardPool = ['squirrel', 'sprout', 'sapling', 'baby_owl'];
    } else if (level === 2) {
      placementProbability = 0.6;
      cardPool = ['sapling', 'bird', 'bifurcated_pine', 'nut_shield', 'elder_deer'];
    } else if (level >= 3) {
      placementProbability = 0.8;
      cardPool = ['oak', 'bifurcated_pine', 'deathtouch_mushroom', 'grove_guardian', 'moss_turtle'];
    }

    for (let i = 0; i < 4; i++) {
      if (this.opponentQueue[i] === null) {
        if (Math.random() < placementProbability) {
          const randomIndex = Math.floor(Math.random() * cardPool.length);
          const cardId = cardPool[randomIndex];
          const card = this.createCard(cardId);

          this.opponentQueue[i] = card;

          log.push({
            type: 'opponent_play',
            slotIndex: i,
            card: { ...card }
          });
        }
      }
    }
  }

  advanceOpponentQueue(log) {
    for (let i = 0; i < 4; i++) {
      if (this.opponentSlots[i] === null && this.opponentQueue[i] !== null) {
        this.opponentSlots[i] = this.opponentQueue[i];
        this.opponentQueue[i] = null;

        log.push({
          type: 'opponent_advance',
          slotIndex: i,
          card: { ...this.opponentSlots[i] }
        });
      }
    }
  }

  resolveTurn() {
    const log = [];

    // 每回合战斗结算开始前，露珠清零
    this.resources.dewdrop = 0;

    // 1. Opponent advances queue to frontline
    this.advanceOpponentQueue(log);

    // 2. Combat Resolution left to right (slots 0 to 3)
    for (let i = 0; i < 4; i++) {
      if (this.isGameOver().finished) {
        break;
      }

      // Player attacks
      const playerCard = this.playerSlots[i];
      if (playerCard && playerCard.hp > 0 && playerCard.attack > 0) {
        if (playerCard.sleeping) {
          playerCard.sleeping = false; // 醒来
          log.push({
            type: 'sleep_skip',
            side: 'player',
            slotIndex: i,
            card: { ...playerCard }
          });
        } else {
          this.resolveCardAttack('player', i, playerCard, log);
        }
      }

      if (this.isGameOver().finished) {
        break;
      }

      // Opponent attacks
      const opponentCard = this.opponentSlots[i];
      if (opponentCard && opponentCard.hp > 0 && opponentCard.attack > 0) {
        if (opponentCard.sleeping) {
          opponentCard.sleeping = false; // 醒来
          log.push({
            type: 'sleep_skip',
            side: 'opponent',
            slotIndex: i,
            card: { ...opponentCard }
          });
        } else {
          this.resolveCardAttack('opponent', i, opponentCard, log);
        }
      }
    }

    // 3. Fledgling 进化与 turnsAlive 计数
    for (let i = 0; i < 4; i++) {
      const pCard = this.playerSlots[i];
      if (pCard) {
        pCard.turnsAlive = (pCard.turnsAlive || 0) + 1;
        if (pCard.sigils.includes('fledgling') && pCard.turnsAlive >= 1) {
          pCard.attack += 1;
          pCard.hp += 2;
          pCard.maxHp += 2;
          pCard.sigils = pCard.sigils.filter(s => s !== 'fledgling');
          if (pCard.id === 'baby_owl') {
            pCard.sigils.push('airborne');
          }
          log.push({
            type: 'fledgling_evolve',
            side: 'player',
            slotIndex: i,
            card: { ...pCard }
          });
        }
      }

      const oCard = this.opponentSlots[i];
      if (oCard) {
        oCard.turnsAlive = (oCard.turnsAlive || 0) + 1;
        if (oCard.sigils.includes('fledgling') && oCard.turnsAlive >= 1) {
          oCard.attack += 1;
          oCard.hp += 2;
          oCard.maxHp += 2;
          oCard.sigils = oCard.sigils.filter(s => s !== 'fledgling');
          if (oCard.id === 'baby_owl') {
            oCard.sigils.push('airborne');
          }
          log.push({
            type: 'fledgling_evolve',
            side: 'opponent',
            slotIndex: i,
            card: { ...oCard }
          });
        }
      }
    }

    // 4. Opponent AI plays new cards to queue for next turn
    this.runOpponentAI(log);

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
      if (this.isGameOver().finished) {
        break;
      }
    }
  }

  executeSingleAttack(attackerSide, fromIdx, targetIdx, card, log) {
    const targetSide = attackerSide === 'player' ? 'opponent' : 'player';
    const targetSlots = targetSide === 'player' ? this.playerSlots : this.opponentSlots;
    const targetCard = targetSlots[targetIdx];
    
    // 计算 Leader 印记攻击加成
    let dmg = card.attack;
    const slots = attackerSide === 'player' ? this.playerSlots : this.opponentSlots;
    if (fromIdx > 0 && slots[fromIdx - 1] && slots[fromIdx - 1].sigils.includes('leader')) {
      dmg += 1;
    }
    if (fromIdx < 3 && slots[fromIdx + 1] && slots[fromIdx + 1].sigils.includes('leader')) {
      dmg += 1;
    }

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

        // 催眠印记
        if (card.sigils.includes('sleepTouch') && dmg > 0 && targetCard.hp > 0) {
          targetCard.sleeping = true;
          log.push({
            type: 'sleepTouch_trigger',
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

          // 不朽印记
          if (targetCard.sigils.includes('unkillable') && targetSide === 'player') {
            this.hand.push(this.createCard(targetCard.id));
            log.push({
              type: 'unkillable_trigger',
              side: targetSide,
              slotIndex: targetIdx,
              card: { ...targetCard }
            });
          }

          // 发放 leaf 离场奖励
          const leafGain = (targetCard.leaveReward && targetCard.leaveReward.leaf !== undefined) ? targetCard.leaveReward.leaf : 1;
          this.resources.leaf += leafGain;
          log.push({
            type: 'resource_gain',
            resource: 'leaf',
            amount: leafGain
          });
        }
      }
    }
  }
}
