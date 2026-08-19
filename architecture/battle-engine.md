# Архитектура модуля боя

Статус: короткий предварительный драфт. Конкретные формулы боя пока не фиксируются.

Контракт `fighterClass` + `weaponSet` + `armorSet` ниже является целевым для
версии `0.6`. Прототип `0.5` пока использует совместимое legacy-поле
`equipmentType`; план миграции описан в спеках классов и снаряжения.

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
  validate(input: BattleInput): BattleValidationResult;
  simulate(input: BattleInput): BattleResult;
}
```

На первом этапе бой рассчитывается целиком синхронно. Анимация и показ событий
игроку выполняются снаружи по журналу уже рассчитанного боя.

`simulate()` запускается только для валидного входа. Несовместимые классы, пустые
слоты, недопустимое качество или лишние перки снаряжения возвращаются через
`validate()` структурированными ошибками и не создают частичное состояние боя.

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

type FighterClassId =
  | "murmillo"
  | "thraex"
  | "retiarius"
  | "secutor"
  | "hoplomachus";

type EquipmentQuality = "common" | "good" | "rare" | "named";

interface EquipmentInstanceRef {
  instanceId: string;
  definitionId: string;
  quality: EquipmentQuality;
  statValues: Record<string, number>;
  additionalPerkIds: readonly string[];
}

interface FighterInput {
  id: string;
  fighterClass: FighterClassId;
  criticalChance: number;
  classTechniqueChance: number;
  base: {
    strength: number;
    health: number;
    charisma: number;
  };
  equipment: {
    weaponSet: EquipmentInstanceRef;
    armorSet: EquipmentInstanceRef;
  };
  perks: readonly BattleModifierRef[];
  buffs: readonly BattleModifierRef[];
  injuries: readonly BattleModifierRef[];
}

interface ArenaInput {
  type: string;
  supportMultipliers: readonly [number, number];
  modifiers?: BattleModifierRef[];
}

interface BattleModifierRef {
  id: string;
  params?: Record<string, unknown>;
}

interface BattleValidationResult {
  valid: boolean;
  errors: readonly {
    code: string;
    fighterId?: string;
    path: string;
    details?: Record<string, unknown>;
  }[];
}

type BattleModifierKind =
  | "perk"
  | "buff"
  | "debuff"
  | "injury"
  | "status"
  | "arena"
  | "equipment"
  | "class-technique";

```

Перед инициализацией движок разрешает определения двух комплектов и проверяет, что
их слоты и `classId` совпадают с `fighterClass`. Тип оружия всегда создаёт один
`equipment-perk` классового приёма. Редкое или именное оружие обязано создать от
одного до двух дополнительных перков, а редкие или именные доспехи — ровно один.
Обычная атака остаётся стандартным действием ядра и не создаёт экземпляр перка.
Полный контракт описан в
[`combat-spec/10-equipment-loadouts.md`](../combat-spec/10-equipment-loadouts.md).

Множитель арены участвует в расчёте динамической поддержки соответствующего
бойца, но сам поддержкой не является.

`perks` содержит не более трёх уникальных постоянных перков бойца. `buffs`
и `injuries` используют тот же интерфейс `BattleModifier`, но передаются отдельными
списками для сохранения семантики входных данных. Эти списки не ограничены по
размеру; одинаковые элементы допускаются и применяются последовательно, поэтому
простые модификаторы складываются.

Поле прототипа `temporaryPerks` считается устаревшим. При переходе на целевой
контракт его элементы нормализуются в `buffs` или `debuffs` согласно `kind`
определения в реестре модификаторов.

При нормализации каждому элементу назначается детерминированный `instanceId`,
составленный из вида модификатора, владельца, позиции во входном списке и `id`
определения. Два одинаковых эффекта остаются двумя независимыми экземплярами.
Прототип `0.3` использует строковый `id` как сокращённую форму `{ id }`; публичный
TypeScript-контракт сохраняет объектную форму для будущих параметров экземпляра.

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
  activeModifiers: ActiveBattleModifierState[];
}

interface FighterBattleState {
  id: string;
  fighterClass: FighterClassId;
  classMatchup: ClassMatchupState;
  equipment: {
    weaponSet: ResolvedEquipmentState;
    armorSet: ResolvedEquipmentState;
  };
  equipmentPerks: readonly string[];
  battleBase: {
    strength: number;
    health: number;
    charisma: number;
  };
  health: number;
  maxHealth: number;
  strength: number;
  support: number;
  initiative: number;
  fatigue: number;
  activeModifiers: ActiveBattleModifierState[];
  traumas: TraumaState[];
}

interface ResolvedEquipmentState {
  instanceId: string;
  definitionId: string;
  equipmentTypeId: string;
  slot: "weapon" | "armor";
  classId: FighterClassId;
  quality: EquipmentQuality;
  appliedStats: Record<string, number>;
  classTechniquePerkId?: string;
  additionalPerkIds: readonly string[];
}

interface ClassMatchupState {
  opponentClass: FighterClassId;
  relation: "advantage" | "disadvantage" | "neutral";
  strengthMultiplier: number;
  initiativeBonus: number;
}

interface ActiveBattleModifierState {
  instanceId: string;
  definitionId: string;
  kind: BattleModifierKind;
  params?: Record<string, unknown>;
  runtime: BattleModifierRuntime;
  stacks?: number;
  remainingActions?: number;
}

interface TraumaState {
  type: string;
  source: "starting-injury" | "battle" | "outcome";
  step: number;
}
```

`battleBase` — модифицированная копия базовых характеристик только для текущего боя.
Она не изменяет постоянные данные гладиатора. Начальные динамические характеристики
рассчитываются из `battleBase`, класса бойца, двух разрешённых комплектов,
модификаторов арены и параметров арены. `fighterClass`, качество, определения комплектов и
созданные из них `equipment-perk` входят в состояние и replay-снимки. `seed` и
единый `RandomSource` обязательны:
одинаковые входные данные и версия правил должны давать одинаковый результат.

## 4. Цикл движка

Движок выполняет фиксированные фазы:

```text
Нормализация входа и создание экземпляров `BattleModifier`
→ разрешение и валидация двух комплектов снаряжения
→ инициализация динамического состояния
→ применение матрицы соотношений классов
→ классовый оружейный приём и дополнительные equipment-perk
→ временные эффекты
→ стартовые травмы
→ постоянные перки
→ финальный пересчёт начальных показателей
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

Временные эффекты и стартовые травмы применяются до первого шага и не считаются
действиями бойца. Модуль боя не управляет их межбоевым жизненным циклом: он только
использует переданные экземпляры в текущей симуляции.

Один шаг соответствует одному полностью обработанному действию бойца. Чтобы избежать
бесконечного боя, движок завершает симуляцию по `maxSteps`. Если на этом шаге
победитель отсутствует, результатом становится ничья. Значение лимита по умолчанию
задаётся конфигурацией правил.

Для боевой травмы прототип использует вынесенные в `COMBAT_RULES.trauma`
параметры: базовый шанс `12%`, прибавку `damageRatio × 0,9`, верхнюю границу
`45%` и равный выбор руки/ноги. Эффект травмы применяется до
`recalculateAll("after-action")`, поэтому дебафф силы или инициативы входит в
тот же snapshot, в котором травма впервые появляется.

## 5. Модификаторы арены

Цикл строится как набор объектов-фаз, а не как один большой метод. Каждая фаза
принимает свои данные и возвращает результат:

```ts
interface BattlePhase<Input, Output> {
  readonly id: BattlePhaseId;
  execute(data: Input, context: ReadonlyBattleContext): Output;
}
```

### Базовая сущность

Общим родителем механик является `BattleModifier`. Это нейтральный контракт,
поэтому его используют постоянные перки, травмы, бафы, дебафы, состояния, эффекты
арены, снаряжение и классовые приёмы.

В русской документации и интерфейсе `BattleModifier` называется
**модификатором арены**. «Арена» здесь означает весь контекст текущего боя, а не
только параметры локации.

Определение модификатора неизменно и может переиспользоваться между боями. Живой
экземпляр создаётся отдельно для конкретного владельца и боя:

```ts
interface BattleModifierInstance<Runtime extends BattleModifierRuntime = BattleModifierRuntime> {
  readonly instanceId: string;
  readonly definition: BattleModifier<Runtime>;
  readonly kind: BattleModifierKind;
  readonly ownerId: string | null;
  readonly sourceId: string | null;
  readonly params: Readonly<Record<string, unknown>>;
  runtime: Runtime;
  status: "active" | "suspended" | "removed";
}
```

`kind` сохраняет доменный смысл, но не меняет способ выполнения. Например, травма
имеет `kind = "injury"`, а классовый приём — `kind = "class-technique"`; оба могут
подписаться на одинаковый hook.

Определение содержит отдельный необязательный метод для каждой точки встраивания.
Наличие метода означает подписку на этот шаг:

```ts
interface BattleModifierRuntime {
  activations: number;
  used?: boolean;
  [key: string]: unknown;
}

interface BattleModifier<Runtime extends BattleModifierRuntime = BattleModifierRuntime> {
  readonly id: string;
  readonly kind: BattleModifierKind;
  readonly priority: number;
  createRuntime(params: Readonly<Record<string, unknown>>): Runtime;

  beforeInitialize?(data: InitializeData, api: BattleModifierApi, runtime: Runtime): InitializeData;
  afterInitialize?(data: InitializedData, api: BattleModifierApi, runtime: Runtime): InitializedData;

  beforeBattleStart?(data: BattleStartData, api: BattleModifierApi, runtime: Runtime): BattleStartData;
  afterBattleStart?(data: BattleStartedData, api: BattleModifierApi, runtime: Runtime): BattleStartedData;

  beforeSelectActor?(data: SelectActorData, api: BattleModifierApi, runtime: Runtime): SelectActorData;
  afterSelectActor?(data: ActorSelectedData, api: BattleModifierApi, runtime: Runtime): ActorSelectedData;

  beforeSelectAction?(data: SelectActionData, api: BattleModifierApi, runtime: Runtime): SelectActionData;
  afterSelectAction?(data: ActionSelectedData, api: BattleModifierApi, runtime: Runtime): ActionSelectedData;

  beforeAction?(data: ActionData, api: BattleModifierApi, runtime: Runtime): ActionData;
  afterAction?(data: ActionResultData, api: BattleModifierApi, runtime: Runtime): ActionResultData;

  beforeApplyEffects?(data: EffectsData, api: BattleModifierApi, runtime: Runtime): EffectsData;
  afterApplyEffects?(data: EffectsResultData, api: BattleModifierApi, runtime: Runtime): EffectsResultData;

  beforeRecalculateSupport?(data: SupportData, api: BattleModifierApi, runtime: Runtime): SupportData;
  afterRecalculateSupport?(data: SupportResultData, api: BattleModifierApi, runtime: Runtime): SupportResultData;

  beforeRecalculateInitiative?(data: InitiativeData, api: BattleModifierApi, runtime: Runtime): InitiativeData;
  afterRecalculateInitiative?(data: InitiativeResultData, api: BattleModifierApi, runtime: Runtime): InitiativeResultData;

  beforeRecalculateStrength?(data: StrengthData, api: BattleModifierApi, runtime: Runtime): StrengthData;
  afterRecalculateStrength?(data: StrengthResultData, api: BattleModifierApi, runtime: Runtime): StrengthResultData;

  beforeDefeatCheck?(data: DefeatCheckData, api: BattleModifierApi, runtime: Runtime): DefeatCheckData;
  afterDefeatCheck?(data: DefeatResultData, api: BattleModifierApi, runtime: Runtime): DefeatResultData;

  beforeStepLimitCheck?(data: StepLimitData, api: BattleModifierApi, runtime: Runtime): StepLimitData;
  afterStepLimitCheck?(data: StepLimitResultData, api: BattleModifierApi, runtime: Runtime): StepLimitResultData;

  beforeOutcome?(data: OutcomeData, api: BattleModifierApi, runtime: Runtime): OutcomeData;
  afterOutcome?(data: OutcomeResultData, api: BattleModifierApi, runtime: Runtime): OutcomeResultData;

  beforeBattleFinish?(data: BattleFinishData, api: BattleModifierApi, runtime: Runtime): BattleFinishData;
  afterBattleFinish?(data: BattleFinishedData, api: BattleModifierApi, runtime: Runtime): BattleFinishedData;
}
```

Все данные конкретного шага передаются в соответствующий метод. Метод возвращает
данные того же этапа и может изменить выбор, вероятность, действие, результат или
набор эффектов. Например, `afterSelectActor` получает уже выбранного бойца и может
вернуть другого, а `beforeAction` может заменить обычный удар особым действием.

`runtime` — изменяемое состояние конкретного экземпляра в пределах одной симуляции.
Оно создаётся заново вместе с экземпляром, не разделяется между одинаковыми
модификаторами и не записывается обратно в постоянные данные гладиатора. Модификатор
может хранить в нём счётчики, флаги одноразового использования или подготовленную
реакцию.

### Менеджер модификаторов арены

`BattleModifierManager` — единственная сущность, которая управляет живыми
модификаторами. Движок и фазы не перебирают перки или травмы самостоятельно.

```ts
interface BattleModifierManager {
  create(
    ref: BattleModifierRef,
    kind: BattleModifierKind,
    ownerId: string | null,
    sourceId?: string | null,
  ): BattleModifierInstance;

  add(instance: BattleModifierInstance): void;
  suspend(instanceId: string): void;
  resume(instanceId: string): void;
  remove(instanceId: string): void;

  runBefore<P extends BattlePhaseId>(phase: P, data: PhaseInput<P>): PhaseInput<P>;
  runAfter<P extends BattlePhaseId>(phase: P, data: PhaseOutput<P>): PhaseOutput<P>;
  snapshot(): readonly ActiveBattleModifierState[];
}
```

Менеджер:

- разрешает `id` через реестр определений;
- создаёт отдельный runtime для каждого экземпляра;
- индексирует модификаторы по реализованным hook-методам;
- сортирует их по `priority`, `definition.id` и `instanceId`;
- пропускает результат одного модификатора во вход следующего;
- фиксирует hook, активацию и изменение runtime в журнале;
- добавляет, приостанавливает и удаляет модификаторы только на безопасной границе фазы.

Модификатор не меняет список активных модификаторов во время его обхода. Для этого
он ставит в очередь `AddBattleModifierEffect`, `SuspendBattleModifierEffect` или
`RemoveBattleModifierEffect`, а менеджер применяет команды после завершения текущего
hook-конвейера.

### Порядок выполнения

Для каждой фазы `BattleModifierManager` через внутренний `HookPipeline` выполняет
один и тот же алгоритм:

```text
исходные данные фазы
→ все before-методы модификаторов арены
→ стандартный расчёт фазы
→ все after-методы модификаторов арены
→ фиксация итогового результата в BattleState
```

Результат одного экземпляра становится входом следующего. Перехватчики сортируются
по `priority`, затем по `definitionId` и `instanceId`, поэтому порядок остаётся
воспроизводимым даже при нескольких одинаковых эффектах.

Для текущего прототипа используются диапазоны приоритетов: эффекты снаряжения —
`40`, временные эффекты — `50`, стартовые травмы — `60`, постоянные перки — `100`.
Внутри снаряжения классовый оружейный приём идёт раньше дополнительных перков. Это
не запрещает конкретному
определению задать иной приоритет, если ему действительно нужно встроиться раньше
или позже.

Пример модификатора-перка, меняющего уже выбранного следующего бойца:

```ts
class ExtraTurnModifier implements BattleModifier {
  readonly id = "extra-turn";
  readonly kind = "perk" as const;
  readonly priority = 100;
  createRuntime = (): BattleModifierRuntime => ({ activations: 0 });

  afterSelectActor(
    data: ActorSelectedData,
    api: BattleModifierApi,
    runtime: BattleModifierRuntime,
  ): ActorSelectedData {
    if (api.ownerId === null || !api.canActivate(this.id)) return data;

    return {
      ...data,
      actorId: api.ownerId,
      reason: "perk",
    };
  }
}
```

Модификаторы не получают прямой изменяемый `BattleState`. Через ограниченный
`BattleModifierApi` они читают снимок состояния, используют общий генератор
случайных чисел и добавляют команды-эффекты в очередь:

```ts
interface BattleModifierApi {
  readonly ownerId: string | null;
  readonly kind: BattleModifierKind;
  readonly instanceId: string;
  readonly state: ReadonlyBattleState;
  random(): number;
  canActivate(modifierId: string): boolean;
  enqueue(effect: BattleEffect): void;
  emit(event: BattleEvent): void;
}
```

Во время `beforeInitialize` простые модификаторы обычно возвращают изменённую боевую
копию характеристик. Преобразованные данные фиксирует движок, а очередь дополнительных эффектов применяет
только `EffectResolver`. Это сохраняет единый порядок изменений, упрощает
журналирование и не позволяет модификаторам незаметно повредить состояние движка.

Для реакций и дополнительных действий устанавливается лимит, защищающий от
бесконечных цепочек перков.

Основные ООП-принципы:

- композиция фаз и модификаторов вместо глубокой иерархии наследования;
- одна ответственность у движка, фазы, обработчика эффектов и сборщика статистики;
- новые перки, травмы и бафы добавляются реализацией `BattleModifier` без изменения ядра;
- генератор случайных чисел, реестры и стратегии расчёта передаются как зависимости.

## 6. Выходные данные

```ts
interface BattleResult {
  schemaVersion: number;
  rulesetVersion: string;
  seed: string | number;
  input: BattleInput;
  outcome: BattleOutcome;
  steps: number;
  fighters: [FighterBattleResult, FighterBattleResult];
  finalArenaState: ArenaBattleState;
  statistics: BattleStatistics;
  events: BattleEvent[];
  snapshots: BattleSnapshot[];
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
  startingInjuries: BattleModifierRef[];
  newTraumas: BattleModifierRef[];
  finalTraumas: TraumaState[];
}

type BattleStatistics = Record<string, {
    actions: number;
    hits: number;
    misses: number;
    dodges: number;
    blocks: number;
    damageDealt: number;
    damageReceived: number;
    traumasReceived: number;
    fatigueGained: number;
    modifierActivations: number;
    perkActivations?: number; // legacy-поле прототипа
    maxConsecutiveActions: number;
    modifierCounters?: Record<string, number>;
}>;

interface BattleEvent {
  sequence: number;
  step: number;
  type: string;
  phase: string;
  message: string;
  actorId?: string;
  targetId?: string;
  modifierKind?: BattleModifierKind;
  instanceId?: string;
  data: Record<string, unknown>;
  state: BattleReplayState;
}

interface BattleReplayState {
  schemaVersion: 1;
  eventSequence: number;
  step: number;
  phase: string;
  status: "running" | "finished";
  outcome: BattleOutcome | null;
  arena: ArenaBattleState;
  fighters: readonly FighterBattleState[];
  pendingEffects: readonly BattleEffect[];
  lastAction?: ActionResultData;
  turn: {
    lastActorId: string | null;
    consecutiveActions: number;
  };
  modifiers: readonly {
    id: string;
    instanceId: string;
    kind: BattleModifierKind;
    ownerId: string | null;
    priority: number;
    runtime: BattleModifierRuntime;
  }[];
}

interface BattleSnapshot {
  index: number;
  step: number;
  label: string;
  status: "running" | "finished";
  outcome: BattleOutcome | null;
  arena: ArenaBattleState;
  fighters: readonly FighterBattleState[];
  lastAction?: ActionResultData;
  eventSequence: number;
}
```

`ActionResultData` сохраняет доменные признаки сработавшего особого действия:
`attackType = "achilles-leap"`, `classTechnique` с id классового оружейного
приёма либо `specialAttack` с id атакующего перка оружия. Это не номера кадров и
не команды рендера: поля входят в replay как причина изменённого боевого
действия, а визуальный адаптер уже самостоятельно сопоставляет их состоянию
`special`. Защитная часть приёма Мурмиллона остаётся в `equipmentReaction`, а
следующий ответный удар получает `classTechnique =
"weapon.murmillo-shield-advance"` и множитель силы `1.25`. После расходования
контратаки техника снова может проверить следующее входящее попадание; пока
ответ подготовлен, повторный блок не создаёт ещё одну контратаку.

Каждый боец также передаёт `classTechniqueChance` в диапазоне `0…1`.
При каждом подходящем для конкретной техники событии движок выполняет отдельный
`classTechniqueRoll`; при `roll >= chance` техника не срабатывает. Дефолт
прототипа — `0.10`, а симулятор предлагает `0/3/5/10/30/50/75/100%`. Успешная проверка
сохраняет шанс и бросок в действии; каждая проверка, включая неуспешную,
фиксируется событием `modifier.chance.checked`.

Для успешного попадания `ActionResultData` дополнительно содержит техническую
трассировку силы и критической проверки:

```ts
interface HitActionResultData extends ActionResultData {
  strikePowerRoll: number;
  strikePowerMultiplier: number; // 0.85…1.15
  damageBeforeCritical: number;
  criticalChance: number; // индивидуальное fighter.criticalChance, 0…1
  criticalRoll: number;
  critical: boolean;
  criticalMultiplier: 1 | 2;
  classTechniqueChance?: number;
  classTechniqueRoll?: number;
  damage: number;
  impact: "light" | "normal" | "strong" | "critical";
}
```

Эти поля записываются в событие `action.damage.resolved`, технический replay и
пошаговый снимок. Игровая лента использует только `impact`; источником точных
чисел она не является. Шанс хранится во входе каждого бойца отдельно; дефолт
равен `0.03`, а симулятор ограничивает выбор значениями `0/3/5/10/30/50%`.
Формула и временный TODO для развития критического шанса
зафиксированы в
[`combat-spec/02-combat-mechanics.md`](../combat-spec/02-combat-mechanics.md).

При `BattleOutcome.type = "draw"` оба бойца получают
`battleOutcome = "draw"`. Последним элементом журнала становится событие завершения
боя с итогом и причиной `step_limit`.

`BattleEvent[]` — упорядоченный технический журнал для отладки, статистики и
восстановления причин каждого изменения. Активации общего hook-конвейера
сохраняются с типами `modifier.hook`, `modifier.activated` и
`modifier.runtime.changed`; поля `modifierKind` и `instanceId` отличают перк от
бафа, травмы, снаряжения или состояния и различают повторяющиеся экземпляры.

Каждое событие содержит `state` со снимком **после записи события**. Это основной
контракт для event-level replay: состояние конкретного события восстанавливается
без повторного расчёта боя и не зависит от последующих мутаций объектов движка.
В состояние входят очередь эффектов и runtime всех экземпляров `BattleModifier`, поэтому
журнал пригоден для отладки отложенных механик и реализации «машины времени».

Скачиваемый журнал использует формат `gladiator.battle-log`, версию формата `1` и
режим replay `state-after-event`. Он включает вход, итог, статистику, события и
пошаговые снимки; события являются источником точного состояния, а снимки — быстрым
индексом для обычного показа боя по действиям.

Для каждого вызова hook журнал сохраняет `runtimeBefore` и `runtimeAfter`. Поэтому
одноразовые и отложенные механики можно воспроизвести и отладить без доступа к
внутреннему объекту экземпляра.

Поле `perkActivations` остаётся только legacy-полем прототипа. Целевой контракт
использует `modifierActivations` и `modifierCounters`, которые считают все виды
модификаторов арены.

`BattleSnapshot[]` содержит начальное состояние, состояние после каждого полностью
обработанного действия и финальное состояние. Поэтому движок рассчитывает бой сразу,
а мобильный UI может показывать один ход каждые несколько секунд, ставить повтор на
паузу и переходить к произвольному шагу без повторного расчёта.

Обычный мобильный UI не должен показывать внутренние числа напрямую: отдельный слой
представления преобразует события и состояния в текст вроде «тяжело дышит» или
«едва стоит». Отладочный прототип намеренно показывает точные значения и активные
модификаторы непосредственно на арене.

## 7. Состав модуля

```text
battle/
├─ domain/       входные, динамические и итоговые типы
├─ engine/       BattleEngine, BattleContext, основной цикл
├─ phases/       стандартные фазы боя
├─ effects/      команды и EffectResolver
├─ modifiers/    BattleModifier, BattleModifierManager, реестр и HookPipeline
├─ random/       seeded RandomSource
├─ result/       OutcomeResolver и сбор результата
└─ statistics/   BattleEvent и StatsCollector
```

Формулы характеристик должны находиться в фазах или отдельных стратегиях расчёта,
а не в `BattleEngine`. Сам движок отвечает только за порядок, перехватываемость и целостность
симуляции.
