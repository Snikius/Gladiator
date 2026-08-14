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
  equipmentType: "murmillo" | "thraex" | "retiarius";
  equipment: {
    weaponPower: number;
    armor: number;
    weight: number;
  };
  perks: readonly PerkRef[];
  temporaryPerks: readonly PerkRef[];
  injuries: readonly PerkRef[];
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

type BattleExtensionKind =
  | "perk"
  | "temporary-perk"
  | "injury"
  | "arena-perk"
  | "equipment-perk";

```

Экипировка при инициализации преобразуется в модификаторы и, при необходимости,
в перки. Выбранный `equipmentType` автоматически создаёт временный экземпляр
`equipment-perk`, который может перехватывать те же фазы, что и постоянный перк.
В прототипе тип также задаёт цикл преимуществ и визуальный скин, но визуальный слой
не участвует в расчётах. Множитель арены участвует в расчёте динамической поддержки соответствующего
бойца, но сам поддержкой не является.

`perks` содержит не более трёх уникальных постоянных перков бойца. `temporaryPerks`
и `injuries` используют тот же интерфейс перехватчиков, но передаются отдельными
списками для сохранения семантики входных данных. Эти списки не ограничены по
размеру; одинаковые элементы допускаются и применяются последовательно, поэтому
простые модификаторы складываются.

При нормализации каждому элементу назначается детерминированный `instanceId`,
составленный из вида расширения, владельца, позиции во входном списке и `id`
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
  activeExtensions: ActiveExtensionState[];
}

interface FighterBattleState {
  id: string;
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
  activeExtensions: ActiveExtensionState[];
  traumas: TraumaState[];
}

interface ActiveExtensionState {
  instanceId: string;
  definitionId: string;
  kind: BattleExtensionKind;
  params?: Record<string, unknown>;
  runtime: PerkRuntimeState;
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
рассчитываются из `battleBase`, экипировки, расширений и параметров арены. `seed` и единый `RandomSource` обязательны:
одинаковые входные данные и версия правил должны давать одинаковый результат.

## 4. Цикл движка

Движок выполняет фиксированные фазы:

```text
Нормализация входа и создание экземпляров расширений
→ инициализация динамического состояния
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

## 5. Расширение перками

Цикл строится как набор объектов-фаз, а не как один большой метод. Каждая фаза
принимает свои данные и возвращает результат:

```ts
interface BattlePhase<Input, Output> {
  readonly id: BattlePhaseId;
  execute(data: Input, context: ReadonlyBattleContext): Output;
}
```

### Общий интерфейс расширения

Постоянный перк, временный эффект и травма используют один контракт `BattlePerk`.
Он содержит отдельный необязательный метод для каждой точки встраивания. Наличие
метода означает, что экземпляр подписан на этот шаг:

```ts
interface PerkRuntimeState {
  activations: number;
  used?: boolean;
  [key: string]: unknown;
}

interface BattlePerk<Runtime extends PerkRuntimeState = PerkRuntimeState> {
  readonly id: string;
  readonly priority: number;

  beforeInitialize?(data: InitializeData, api: PerkBattleApi, runtime: Runtime): InitializeData;
  afterInitialize?(data: InitializedData, api: PerkBattleApi, runtime: Runtime): InitializedData;

  beforeBattleStart?(data: BattleStartData, api: PerkBattleApi, runtime: Runtime): BattleStartData;
  afterBattleStart?(data: BattleStartedData, api: PerkBattleApi, runtime: Runtime): BattleStartedData;

  beforeSelectActor?(data: SelectActorData, api: PerkBattleApi, runtime: Runtime): SelectActorData;
  afterSelectActor?(data: ActorSelectedData, api: PerkBattleApi, runtime: Runtime): ActorSelectedData;

  beforeSelectAction?(data: SelectActionData, api: PerkBattleApi, runtime: Runtime): SelectActionData;
  afterSelectAction?(data: ActionSelectedData, api: PerkBattleApi, runtime: Runtime): ActionSelectedData;

  beforeAction?(data: ActionData, api: PerkBattleApi, runtime: Runtime): ActionData;
  afterAction?(data: ActionResultData, api: PerkBattleApi, runtime: Runtime): ActionResultData;

  beforeApplyEffects?(data: EffectsData, api: PerkBattleApi, runtime: Runtime): EffectsData;
  afterApplyEffects?(data: EffectsResultData, api: PerkBattleApi, runtime: Runtime): EffectsResultData;

  beforeRecalculateSupport?(data: SupportData, api: PerkBattleApi, runtime: Runtime): SupportData;
  afterRecalculateSupport?(data: SupportResultData, api: PerkBattleApi, runtime: Runtime): SupportResultData;

  beforeRecalculateInitiative?(data: InitiativeData, api: PerkBattleApi, runtime: Runtime): InitiativeData;
  afterRecalculateInitiative?(data: InitiativeResultData, api: PerkBattleApi, runtime: Runtime): InitiativeResultData;

  beforeRecalculateStrength?(data: StrengthData, api: PerkBattleApi, runtime: Runtime): StrengthData;
  afterRecalculateStrength?(data: StrengthResultData, api: PerkBattleApi, runtime: Runtime): StrengthResultData;

  beforeDefeatCheck?(data: DefeatCheckData, api: PerkBattleApi, runtime: Runtime): DefeatCheckData;
  afterDefeatCheck?(data: DefeatResultData, api: PerkBattleApi, runtime: Runtime): DefeatResultData;

  beforeStepLimitCheck?(data: StepLimitData, api: PerkBattleApi, runtime: Runtime): StepLimitData;
  afterStepLimitCheck?(data: StepLimitResultData, api: PerkBattleApi, runtime: Runtime): StepLimitResultData;

  beforeOutcome?(data: OutcomeData, api: PerkBattleApi, runtime: Runtime): OutcomeData;
  afterOutcome?(data: OutcomeResultData, api: PerkBattleApi, runtime: Runtime): OutcomeResultData;

  beforeBattleFinish?(data: BattleFinishData, api: PerkBattleApi, runtime: Runtime): BattleFinishData;
  afterBattleFinish?(data: BattleFinishedData, api: PerkBattleApi, runtime: Runtime): BattleFinishedData;
}
```

Все данные конкретного шага передаются в соответствующий метод. Метод возвращает
данные того же этапа и может изменить выбор, вероятность, действие, результат или
набор эффектов. Например, `afterSelectActor` получает уже выбранного бойца и может
вернуть другого, а `beforeAction` может заменить обычный удар действием перка.

`runtime` — изменяемое состояние конкретного экземпляра в пределах одной симуляции.
Оно создаётся заново вместе с экземпляром движка, не разделяется между одинаковыми
перками и не записывается обратно в постоянные данные гладиатора. Перк может хранить
в нём счётчики, флаги одноразового использования или подготовленную реакцию.

### Порядок выполнения

Для каждой фазы `HookPipeline` выполняет один и тот же алгоритм:

```text
исходные данные фазы
→ все before-методы перков
→ стандартный расчёт фазы
→ все after-методы перков
→ фиксация итогового результата в BattleState
```

Результат одного экземпляра становится входом следующего. Перехватчики сортируются
по `priority`, затем по `definitionId` и `instanceId`, поэтому порядок остаётся
воспроизводимым даже при нескольких одинаковых эффектах.

Для текущего прототипа используются диапазоны приоритетов: специализации экипировки — `40`,
временные эффекты — `50`, стартовые травмы — `60`, постоянные перки — `100`. Это не запрещает конкретному
определению задать иной приоритет, если ему действительно нужно встроиться раньше
или позже.

Пример перка, меняющего уже выбранного следующего бойца:

```ts
class ExtraTurnPerk implements BattlePerk {
  readonly id = "extra-turn";
  readonly priority = 100;

  afterSelectActor(
    data: ActorSelectedData,
    api: PerkBattleApi,
    runtime: PerkRuntimeState,
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

Перки не получают прямой изменяемый `BattleState`. Через ограниченный `PerkBattleApi`
они читают снимок состояния, используют общий генератор случайных чисел и добавляют
дополнительные команды-эффекты в очередь:

```ts
interface PerkBattleApi {
  readonly ownerId: string | null;
  readonly extensionType: BattleExtensionKind;
  readonly instanceId: string;
  readonly state: ReadonlyBattleState;
  random(): number;
  canActivate(perkId: string): boolean;
  enqueue(effect: BattleEffect): void;
  emit(event: BattleEvent): void;
}
```

Во время `beforeInitialize` простые расширения обычно возвращают изменённую боевую
копию характеристик. Преобразованные данные фиксирует движок, а очередь дополнительных эффектов применяет
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
  startingInjuries: PerkRef[];
  newTraumas: PerkRef[];
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
    perkActivations: number;
    maxConsecutiveActions: number;
    extensionCounters?: Record<string, number>;
}>;

interface BattleEvent {
  sequence: number;
  step: number;
  type: string;
  phase: string;
  message: string;
  actorId?: string;
  targetId?: string;
  extensionType?: BattleExtensionKind;
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
  extensions: readonly {
    id: string;
    instanceId: string;
    extensionType: BattleExtensionKind;
    ownerId: string;
    priority: number;
    runtime: PerkRuntimeState;
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

При `BattleOutcome.type = "draw"` оба бойца получают
`battleOutcome = "draw"`. Последним элементом журнала становится событие завершения
боя с итогом и причиной `step_limit`.

`BattleEvent[]` — упорядоченный технический журнал для отладки, статистики и
восстановления причин каждого изменения. Активации общего hook-конвейера могут
сохраняться с типами `perk.hook` и `perk.activated`; поля `extensionType` и
`instanceId` отличают постоянный перк от временного эффекта или травмы и различают
повторяющиеся экземпляры.

Каждое событие содержит `state` со снимком **после записи события**. Это основной
контракт для event-level replay: состояние конкретного события восстанавливается
без повторного расчёта боя и не зависит от последующих мутаций объектов движка.
В состояние входят очередь эффектов и runtime всех экземпляров расширений, поэтому
журнал пригоден для отладки отложенных механик и реализации «машины времени».

Скачиваемый журнал использует формат `gladiator.battle-log`, версию формата `1` и
режим replay `state-after-event`. Он включает вход, итог, статистику, события и
пошаговые снимки; события являются источником точного состояния, а снимки — быстрым
индексом для обычного показа боя по действиям.

Для каждого вызова hook журнал сохраняет `runtimeBefore` и `runtimeAfter`. Поэтому
одноразовые и отложенные механики можно воспроизвести и отладить без доступа к
внутреннему объекту экземпляра.

Поле `perkActivations` в статистике прототипа сохранено как совместимое имя, но
считает активации всех видов расширений. При переходе к детализации по экземплярам
используется `extensionCounters`.

`BattleSnapshot[]` содержит начальное состояние, состояние после каждого полностью
обработанного действия и финальное состояние. Поэтому движок рассчитывает бой сразу,
а мобильный UI может показывать один ход каждые несколько секунд, ставить повтор на
паузу и переходить к произвольному шагу без повторного расчёта.

Обычный мобильный UI не должен показывать внутренние числа напрямую: отдельный слой
представления преобразует события и состояния в текст вроде «тяжело дышит» или
«едва стоит». Отладочный прототип намеренно показывает точные значения и активные
расширения непосредственно на арене.

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
