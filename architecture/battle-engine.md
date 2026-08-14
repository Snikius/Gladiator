# Архитектура модуля боя

Статус: короткий предварительный драфт. Конкретные формулы боя пока не фиксируются.

## 1. Назначение

Модуль боя — независимый от мобильного интерфейса движок, который:

- принимает исходные данные двух бойцов и арены;
- создаёт динамическое состояние боя;
- выполняет воспроизводимый цикл действий;
- позволяет перкам перехватывать и расширять любую фазу;
- возвращает итог, финальное состояние, статистику и журнал событий.

Основной публичный контракт:

```ts
interface BattleEngine {
  simulate(input: BattleInput): BattleResult;
}
```

На первом этапе бой рассчитывается целиком синхронно. Анимация и показ событий
игроку выполняются снаружи по журналу уже рассчитанного боя.

## 2. Входные данные

Вход должен быть сериализуемым: только данные и идентификаторы, без функций и
экземпляров классов. Реализации перков и экипировки движок получает из реестров.

```ts
interface BattleInput {
  schemaVersion: number;
  rulesetVersion: string;
  seed: string | number;
  fighters: readonly [FighterInput, FighterInput];
  arena: ArenaInput;
  limits?: {
    maxSteps?: number;
  };
}

interface FighterInput {
  id: string;
  base: {
    strength: number;
    health: number;
    charisma: number;
  };
  equipment: EquipmentRef[];
  perks: PerkRef[];
}

interface ArenaInput {
  type: string;
  supportMultipliers: readonly [number, number];
  perks?: PerkRef[];
}

interface PerkRef {
  id: string;
  params?: Record<string, unknown>;
}

interface EquipmentRef {
  id: string;
  params?: Record<string, unknown>;
}
```

Экипировка при инициализации преобразуется в модификаторы и, при необходимости,
в перки. Множитель арены участвует в расчёте динамической поддержки соответствующего
бойца, но сам поддержкой не является.

## 3. Состояние боя

`BattleContext` существует только внутри одной симуляции:

```ts
interface BattleContext {
  readonly input: BattleInput;
  state: BattleState;
  readonly random: RandomSource;
  readonly events: BattleEvent[];
}

interface BattleState {
  step: number;
  status: "running" | "finished";
  fighters: [FighterBattleState, FighterBattleState];
  arena: ArenaBattleState;
  pendingEffects: BattleEffect[];
}

interface ArenaBattleState {
  type: string;
  supportMultipliers: [number, number];
  activePerks: ActivePerkState[];
}

interface FighterBattleState {
  id: string;
  health: number;
  strength: number;
  support: number;
  initiative: number;
  fatigue: number;
  activePerks: ActivePerkState[];
}

interface ActivePerkState {
  id: string;
  params?: Record<string, unknown>;
  stacks?: number;
  remainingActions?: number;
}
```

Начальные динамические характеристики рассчитываются из базовых характеристик,
экипировки, перков и параметров арены. `seed` и единый `RandomSource` обязательны:
одинаковые входные данные и версия правил должны давать одинаковый результат.

## 4. Цикл движка

Движок выполняет фиксированные фазы:

```text
Инициализация динамического состояния
→ начало боя
→ выбор действующего бойца
→ выбор действия
→ расчёт результата: промах / уворот / блок / попадание / травма
→ применение эффектов: здоровье / усталость / травмы / другие изменения
→ обработка реакций перков
→ пересчёт поддержки
→ пересчёт инициативы
→ пересчёт силы и остальных модификаторов
→ проверка поражения и наличия победителя
→ проверка лимита шагов и фиксация ничьей
→ следующий шаг либо определение итоговых последствий
→ завершение боя
```

Нулевое здоровье означает стандартное поражение, а не смерть. После определения
результата боя отдельный `OutcomeResolver` рассчитывает выживание и итоговые травмы.

Один шаг соответствует одному полностью обработанному действию бойца. Чтобы избежать
бесконечного боя, движок завершает симуляцию по `maxSteps`. Если на этом шаге
победитель отсутствует, результатом становится ничья. Значение лимита по умолчанию
задаётся конфигурацией правил.

## 5. Расширение перками

Цикл строится как набор объектов-фаз, а не как один большой метод. Каждая фаза
принимает свои данные и возвращает результат:

```ts
interface BattlePhase<Input, Output> {
  readonly id: BattlePhaseId;
  execute(data: Input, context: ReadonlyBattleContext): Output;
}
```

### Интерфейс перка

`BattlePerk` содержит отдельный необязательный метод для каждой точки встраивания.
Наличие метода означает, что перк подписан на этот шаг:

```ts
interface BattlePerk {
  readonly id: string;
  readonly priority: number;

  beforeInitialize?(data: InitializeData, api: PerkBattleApi): InitializeData;
  afterInitialize?(data: InitializedData, api: PerkBattleApi): InitializedData;

  beforeBattleStart?(data: BattleStartData, api: PerkBattleApi): BattleStartData;
  afterBattleStart?(data: BattleStartedData, api: PerkBattleApi): BattleStartedData;

  beforeSelectActor?(data: SelectActorData, api: PerkBattleApi): SelectActorData;
  afterSelectActor?(data: ActorSelectedData, api: PerkBattleApi): ActorSelectedData;

  beforeSelectAction?(data: SelectActionData, api: PerkBattleApi): SelectActionData;
  afterSelectAction?(data: ActionSelectedData, api: PerkBattleApi): ActionSelectedData;

  beforeAction?(data: ActionData, api: PerkBattleApi): ActionData;
  afterAction?(data: ActionResultData, api: PerkBattleApi): ActionResultData;

  beforeApplyEffects?(data: EffectsData, api: PerkBattleApi): EffectsData;
  afterApplyEffects?(data: EffectsResultData, api: PerkBattleApi): EffectsResultData;

  beforeRecalculateSupport?(data: SupportData, api: PerkBattleApi): SupportData;
  afterRecalculateSupport?(data: SupportResultData, api: PerkBattleApi): SupportResultData;

  beforeRecalculateInitiative?(data: InitiativeData, api: PerkBattleApi): InitiativeData;
  afterRecalculateInitiative?(data: InitiativeResultData, api: PerkBattleApi): InitiativeResultData;

  beforeRecalculateStrength?(data: StrengthData, api: PerkBattleApi): StrengthData;
  afterRecalculateStrength?(data: StrengthResultData, api: PerkBattleApi): StrengthResultData;

  beforeDefeatCheck?(data: DefeatCheckData, api: PerkBattleApi): DefeatCheckData;
  afterDefeatCheck?(data: DefeatResultData, api: PerkBattleApi): DefeatResultData;

  beforeStepLimitCheck?(data: StepLimitData, api: PerkBattleApi): StepLimitData;
  afterStepLimitCheck?(data: StepLimitResultData, api: PerkBattleApi): StepLimitResultData;

  beforeOutcome?(data: OutcomeData, api: PerkBattleApi): OutcomeData;
  afterOutcome?(data: OutcomeResultData, api: PerkBattleApi): OutcomeResultData;

  beforeBattleFinish?(data: BattleFinishData, api: PerkBattleApi): BattleFinishData;
  afterBattleFinish?(data: BattleFinishedData, api: PerkBattleApi): BattleFinishedData;
}
```

Все данные конкретного шага передаются в соответствующий метод. Метод возвращает
данные того же этапа и может изменить выбор, вероятность, действие, результат или
набор эффектов. Например, `afterSelectActor` получает уже выбранного бойца и может
вернуть другого, а `beforeAction` может заменить обычный удар действием перка.

### Порядок выполнения

Для каждой фазы `HookPipeline` выполняет один и тот же алгоритм:

```text
исходные данные фазы
→ все before-методы перков
→ стандартный расчёт фазы
→ все after-методы перков
→ фиксация итогового результата в BattleState
```

Результат одного перка становится входом следующего. Перехватчики сортируются по
`priority`, затем по `perkId`, поэтому порядок остаётся воспроизводимым.

Пример перка, меняющего уже выбранного следующего бойца:

```ts
class ExtraTurnPerk implements BattlePerk {
  readonly id = "extra-turn";
  readonly priority = 100;

  afterSelectActor(data: ActorSelectedData, api: PerkBattleApi): ActorSelectedData {
    if (api.ownerId === null || !api.canActivate(this.id)) return data;

    return {
      ...data,
      actorId: api.ownerId,
      reason: "perk",
    };
  }
}
```

Перки не получают прямой изменяемый `BattleState`. Через ограниченный `PerkBattleApi`
они читают снимок состояния, используют общий генератор случайных чисел и добавляют
дополнительные команды-эффекты в очередь:

```ts
interface PerkBattleApi {
  readonly ownerId: string | null;
  readonly state: ReadonlyBattleState;
  random(): number;
  canActivate(perkId: string): boolean;
  enqueue(effect: BattleEffect): void;
  emit(event: BattleEvent): void;
}
```

Преобразованные данные фиксирует движок, а очередь дополнительных эффектов применяет
только `EffectResolver`. Это сохраняет единый порядок изменений, упрощает
журналирование и не позволяет перкам незаметно повредить состояние движка.

Для реакций и дополнительных действий устанавливается лимит, защищающий от
бесконечных цепочек перков.

Основные ООП-принципы:

- композиция фаз и перков вместо глубокой иерархии наследования;
- одна ответственность у движка, фазы, обработчика эффектов и сборщика статистики;
- новые перки добавляются реализацией интерфейса без изменения ядра;
- генератор случайных чисел, реестры и стратегии расчёта передаются как зависимости.

## 6. Выходные данные

```ts
interface BattleResult {
  schemaVersion: number;
  rulesetVersion: string;
  seed: string | number;
  outcome: BattleOutcome;
  steps: number;
  fighters: [FighterBattleResult, FighterBattleResult];
  finalArenaState: ArenaBattleState;
  statistics: BattleStatistics;
  events: BattleEvent[];
}

type BattleOutcome =
  | {
      type: "victory";
      winnerId: string;
      loserId: string;
      reason: "defeat" | "perk";
    }
  | {
      type: "draw";
      reason: "step_limit";
    };

interface FighterBattleResult {
  id: string;
  battleOutcome: "victory" | "defeat" | "draw";
  survived: boolean;
  finalState: FighterBattleState;
  newTraumas: PerkRef[];
}

interface BattleStatistics {
  byFighter: Record<string, {
    actions: number;
    hits: number;
    misses: number;
    dodges: number;
    blocks: number;
    damageDealt: number;
    damageReceived: number;
    traumasReceived: number;
    perkCounters: Record<string, number>;
  }>;
}

interface BattleEvent {
  sequence: number;
  step: number;
  type: string;
  actorId?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}
```

При `BattleOutcome.type = "draw"` оба бойца получают
`battleOutcome = "draw"`. Последним элементом журнала становится событие завершения
боя с итогом и причиной `step_limit`.

`BattleEvent[]` — упорядоченный семантический журнал для повтора боя, отладки и
сбора статистики. Мобильный UI не должен показывать внутренние числа напрямую:
отдельный слой представления преобразует события и состояния в текст вроде
«тяжело дышит» или «едва стоит».

## 7. Состав модуля

```text
battle/
├─ domain/       входные, динамические и итоговые типы
├─ engine/       BattleEngine, BattleContext, основной цикл
├─ phases/       стандартные фазы боя
├─ effects/      команды и EffectResolver
├─ perks/        интерфейсы, реестр и HookPipeline
├─ random/       seeded RandomSource
├─ result/       OutcomeResolver и сбор результата
└─ statistics/   BattleEvent и StatsCollector
```

Формулы характеристик должны находиться в фазах или отдельных стратегиях расчёта,
а не в `BattleEngine`. Сам движок отвечает только за порядок, расширение и целостность
симуляции.
