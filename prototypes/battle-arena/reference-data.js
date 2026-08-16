(function () {
"use strict";

const classes = [
  { id: "murmillo", name: "Мурмиллон", role: "Тяжёлый щитовик", weaponId: "murmillo-arms", armorId: "murmillo-armor", beats: "thraex", losesTo: "retiarius", icon: "shield", description: "Держит строй большим скутумом, сближается под защитой щита и отвечает коротким гладиусом." },
  { id: "thraex", name: "Фракиец", role: "Подвижный дуэлянт", weaponId: "thraex-arms", armorId: "thraex-armor", beats: "hoplomachus", losesTo: "murmillo", icon: "sica", description: "Использует малый щит, мобильность и изогнутую сику для атак в обход защиты." },
  { id: "retiarius", name: "Ретиарий", role: "Контроль дистанции", weaponId: "retiarius-arms", armorId: "retiarius-armor", beats: "murmillo", losesTo: "secutor", icon: "net", description: "Лёгкий боец без шлема: удерживает дистанцию трезубцем и перехватывает темп сетью." },
  { id: "secutor", name: "Секутор", role: "Тяжёлый преследователь", weaponId: "secutor-arms", armorId: "secutor-armor", beats: "retiarius", losesTo: "hoplomachus", icon: "helmet", description: "Защищённый преследователь, рассчитанный на постоянное давление и быстрое сокращение дистанции." },
  { id: "hoplomachus", name: "Гопломах", role: "Копейщик", weaponId: "hoplomachus-arms", armorId: "hoplomachus-armor", beats: "secutor", losesTo: "thraex", icon: "spear", description: "Контролирует подход копьём, прикрывается малым щитом и использует кинжал в ближнем бою." },
];

const weapons = [
  { id: "murmillo-arms", classId: "murmillo", name: "Гладиус и скутум", icon: "sword", techniqueId: "weapon.murmillo-shield-advance", profile: ["короткая дистанция", "сильный блок", "контратака"], description: "Классовый комплект Мурмиллона. Экземпляры отличаются числовыми показателями и качеством." },
  { id: "thraex-arms", classId: "thraex", name: "Сика и пармула", icon: "sica", techniqueId: "weapon.thraex-hooking-slash", profile: ["обход щита", "мобильность", "средняя защита"], description: "Изогнутый клинок для ударов за щит и малая пармула, не мешающая движению." },
  { id: "retiarius-arms", classId: "retiarius", name: "Сеть, трезубец и кинжал", icon: "net", techniqueId: "weapon.retiarius-net-cast", profile: ["дальняя дистанция", "контроль", "лёгкий вес"], description: "Сеть меняет темп боя, трезубец удерживает дистанцию, кинжал остаётся резервным оружием." },
  { id: "secutor-arms", classId: "secutor", name: "Гладиус и скутум Секутора", icon: "sword", techniqueId: "weapon.secutor-relentless-pursuit", profile: ["преследование", "короткая дистанция", "давление"], description: "Внешне близок к комплекту Мурмиллона, но является отдельным классовым стилем с другим приёмом." },
  { id: "hoplomachus-arms", classId: "hoplomachus", name: "Копьё, щит и кинжал", icon: "spear", techniqueId: "weapon.hoplomachus-spear-distance", profile: ["дистанция копья", "первый удар", "резервный кинжал"], description: "Копьё контролирует подход, круглый щит прикрывает корпус, кинжал используется после сближения." },
];

const armor = [
  { id: "murmillo-armor", classId: "murmillo", name: "Тяжёлый комплект Мурмиллона", icon: "armor", profile: ["высокая броня", "высокий вес", "гребневой шлем"], description: "Закрытый шлем, маника и короткая поножа. Рассчитан на работу за большим щитом." },
  { id: "thraex-armor", classId: "thraex", name: "Подвижный комплект Фракийца", icon: "greaves", profile: ["средняя броня", "умеренный вес", "высокие поножи"], description: "Защищает ноги и вооружённую руку, сохраняя свободу перемещения." },
  { id: "retiarius-armor", classId: "retiarius", name: "Лёгкий комплект Ретиария", icon: "shoulder", profile: ["малая броня", "минимальный вес", "без шлема"], description: "Галерус и маника защищают плечо и руку, не мешая сети и трезубцу." },
  { id: "secutor-armor", classId: "secutor", name: "Закрытый комплект Секутора", icon: "helmet", profile: ["высокая броня", "высокий вес", "гладкий шлем"], description: "Гладкий шлем с малыми отверстиями и тяжёлая защита помогают идти через сеть и трезубец." },
  { id: "hoplomachus-armor", classId: "hoplomachus", name: "Комплект Гопломаха", icon: "greaves", profile: ["средняя броня", "умеренный вес", "защита ног"], description: "Шлем, маника, высокие поножи и стёганая защита ног для копейной стойки." },
];

const perks = [
  { id: "cornered-beast", group: "fighter", name: "Загнанный зверь", icon: "claw", status: "prototype", effect: "При здоровье 35% и ниже увеличивает текущую силу на 50%." },
  { id: "strong-bones", group: "fighter", name: "Крепкие кости", icon: "bone", status: "prototype", effect: "Снижает вероятность боевой и итоговой травмы на 65%." },
  { id: "crowd-favorite", group: "fighter", name: "Любимец толпы", icon: "crowd", status: "prototype", effect: "После каждого пересчёта получает +6 к динамической поддержке." },
  { id: "turn-interceptor", group: "fighter", name: "Перехват хода", icon: "turn", status: "prototype", effect: "Один раз за бой заменяет уже выбранного противника на владельца перка." },
  { id: "light-footed", group: "fighter", name: "Лёгкая поступь", icon: "boot", status: "prototype", effect: "Уменьшает усталость за действия, блоки и увороты на 25%." },
  { id: "redhead", group: "fighter", name: "Рыжий", icon: "hair", status: "prototype", effect: "Понижает харизму на 10 перед боем. Публика почему-то предвзята." },
  { id: "skilled-warrior", group: "fighter", name: "Умелый воин", icon: "star", status: "prototype", effect: "После блока, уворота или промаха врага гарантированно получает следующий ход." },
  { id: "show-off", group: "fighter", name: "Позёр", icon: "crowd", status: "prototype", effect: "После собственного блока или уворота получает +5 поддержки и +2 усталости." },
  { id: "lovable-loser", group: "fighter", name: "Любимец неудач", icon: "heart", status: "prototype", effect: "После собственного промаха получает +4 поддержки: публика оценила старание." },
  { id: "achilles-leap", group: "fighter", name: "Прыжок Ахилла", icon: "leap", status: "prototype", effect: "С шансом 10% заменяет атаку ударом сверху: +50% силы, нельзя заблокировать или увернуться." },

  { id: "bath-effect", group: "temporary", name: "Эффект бани", icon: "steam", status: "prototype", effect: "+4 к силе, +8 к здоровью и +4 к харизме на этот бой." },
  { id: "wine", group: "temporary", name: "Вино", icon: "wine", status: "prototype", effect: "+8 к харизме и +10 к здоровью, но −5 к силе." },
  { id: "hearty-meal", group: "temporary", name: "Сытный обед", icon: "meal", status: "prototype", effect: "+15 к здоровью, но +6 стартовой усталости." },
  { id: "trainer-warmup", group: "temporary", name: "Разминка с тренером", icon: "fist", status: "prototype", effect: "+7 к силе, но +4 стартовой усталости." },
  { id: "priest-blessing", group: "temporary", name: "Благословение жреца", icon: "sun", status: "prototype", effect: "+5 к здоровью, +6 к харизме и +4 к поддержке." },
  { id: "battle-tonic", group: "temporary", name: "Боевой настой", icon: "flask", status: "prototype", effect: "+9 к силе, −8 к здоровью и +8 стартовой усталости." },
  { id: "good-sleep", group: "temporary", name: "Хороший сон", icon: "moon", status: "prototype", effect: "+3 к силе, +6 к здоровью и +2 к харизме." },

  { id: "leg-damage", group: "injury", name: "Повреждение ноги", icon: "boot", status: "prototype", effect: "Снижает инициативу и добавляет +8 стартовой усталости." },
  { id: "arm-damage", group: "injury", name: "Повреждение руки", icon: "arm", status: "prototype", effect: "Снижает текущую силу на 15%." },
  { id: "head-damage", group: "injury", name: "Повреждение головы", icon: "head", status: "prototype", effect: "Даёт −12 к харизме и +10 стартовой усталости." },
  { id: "bruised-ribs", group: "injury", name: "Ушиб рёбер", icon: "ribs", status: "prototype", effect: "Уменьшает максимальное здоровье на 18 и добавляет +5 стартовой усталости." },
  { id: "exhaustion", group: "injury", name: "Истощение", icon: "fatigue", status: "prototype", effect: "Даёт −8 к силе и +20 стартовой усталости." },

  { id: "weapon.murmillo-shield-advance", group: "technique", classId: "murmillo", name: "Наступление за щитом", icon: "shield", status: "draft", effect: "После блока готовит усиленный ответный удар или повышает вес следующего хода." },
  { id: "weapon.thraex-hooking-slash", group: "technique", classId: "thraex", name: "Подсекающий удар сикой", icon: "sica", status: "draft", effect: "Может обойти щит и превратить блок в ослабленное попадание." },
  { id: "weapon.retiarius-net-cast", group: "technique", classId: "retiarius", name: "Бросок сети", icon: "net", status: "draft", effect: "Перехватывает темп, ограничивает инициативу или добавляет цели усталость." },
  { id: "weapon.secutor-relentless-pursuit", group: "technique", classId: "secutor", name: "Неотступное преследование", icon: "helmet", status: "draft", effect: "Промах или уворот противника усиливает следующую попытку сближения." },
  { id: "weapon.hoplomachus-spear-distance", group: "technique", classId: "hoplomachus", name: "Дистанция копья", icon: "spear", status: "draft", effect: "Первый удар получает преимущество дистанции и меняет доступную защиту цели." },

  { id: "weapon.honed-edge", group: "weapon", name: "Отточенная кромка", icon: "sword", status: "draft", effect: "Первое успешное попадание наносит дополнительный урон." },
  { id: "weapon.deceptive-feint", group: "weapon", name: "Обманный финт", icon: "turn", status: "draft", effect: "Иногда снижает шанс блока цели перед расчётом защиты." },
  { id: "weapon.blood-seeker", group: "weapon", name: "Ищущий кровь", icon: "drop", status: "draft", effect: "Получает небольшой бонус силы против уже раненой цели." },
  { id: "weapon.counterweight", group: "weapon", name: "Точный противовес", icon: "balance", status: "draft", effect: "Уменьшает усталость владельца от атак этим оружием." },
  { id: "weapon.guard-breaker", group: "weapon", name: "Разрушитель защиты", icon: "broken-shield", status: "draft", effect: "После блока противника добавляет ему дополнительную усталость." },
  { id: "weapon.quick-recovery", group: "weapon", name: "Быстрое возвращение", icon: "turn", status: "draft", effect: "После собственного промаха частично сохраняет инициативу." },

  { id: "armor.reinforced-lining", group: "armor", name: "Усиленная подкладка", icon: "armor", status: "draft", effect: "Один раз за бой уменьшает урон первого успешного попадания." },
  { id: "armor.balanced-straps", group: "armor", name: "Удобные ремни", icon: "belt", status: "draft", effect: "Уменьшает усталость, получаемую владельцем при блокировании." },
  { id: "armor.closed-visor", group: "armor", name: "Закрытое забрало", icon: "helmet", status: "draft", effect: "Снижает вероятность ранения или травмы головы." },
  { id: "armor.flexible-joints", group: "armor", name: "Подвижные сочленения", icon: "joint", status: "draft", effect: "Частично уменьшает штраф тяжёлых доспехов к увороту и инициативе." },
  { id: "armor.layered-padding", group: "armor", name: "Многослойная стёжка", icon: "layers", status: "draft", effect: "Снижает небольшой фиксированный объём урона каждого попадания." },
  { id: "armor.last-plate", group: "armor", name: "Последняя пластина", icon: "plate", status: "draft", effect: "Один раз предотвращает падение здоровья до нуля и оставляет владельцу 1 HP." },
  { id: "armor.sand-seals", group: "armor", name: "Защита от песка", icon: "sand", status: "draft", effect: "На Песчаной арене ослабляет негативные эффекты песка." },
];

const qualities = [
  { id: "common", name: "Обычное", weaponPerks: "классовый приём", armorPerks: "нет", tone: "common" },
  { id: "good", name: "Хорошее", weaponPerks: "классовый приём", armorPerks: "нет", tone: "good" },
  { id: "rare", name: "Редкое", weaponPerks: "приём + 1–2 перка", armorPerks: "ровно 1 перк", tone: "rare" },
  { id: "named", name: "Именное", weaponPerks: "приём + 1–2 перка", armorPerks: "ровно 1 перк", tone: "named" },
];

const weaponItemBlueprints = [
  { classId: "murmillo", setId: "murmillo-arms", icon: "sword", variants: [
    ["common", "Казарменный гладиус и скутум", { weaponPower: 12, accuracy: 0, weight: 12 }, []],
    ["good", "Закалённый гладиус и скутум", { weaponPower: 15, accuracy: 2, weight: 11 }, []],
    ["rare", "Гладиус ветерана", { weaponPower: 18, accuracy: 3, weight: 10 }, ["weapon.honed-edge"]],
    ["named", "Зуб Капуи", { weaponPower: 21, accuracy: 5, weight: 9 }, ["weapon.guard-breaker", "weapon.quick-recovery"]],
  ] },
  { classId: "thraex", setId: "thraex-arms", icon: "sica", variants: [
    ["common", "Простая сика и пармула", { weaponPower: 13, accuracy: 1, weight: 8 }, []],
    ["good", "Уравновешенная сика", { weaponPower: 16, accuracy: 3, weight: 7 }, []],
    ["rare", "Сика горного волка", { weaponPower: 19, accuracy: 5, weight: 7 }, ["weapon.deceptive-feint"]],
    ["named", "Клык Родоп", { weaponPower: 22, accuracy: 7, weight: 6 }, ["weapon.deceptive-feint", "weapon.blood-seeker"]],
  ] },
  { classId: "retiarius", setId: "retiarius-arms", icon: "net", variants: [
    ["common", "Учебная сеть и трезубец", { weaponPower: 11, accuracy: 1, weight: 7 }, []],
    ["good", "Крепкая сеть и трезубец", { weaponPower: 14, accuracy: 3, weight: 6 }, []],
    ["rare", "Сеть портового ловца", { weaponPower: 17, accuracy: 5, weight: 5 }, ["weapon.quick-recovery"]],
    ["named", "Дар Нептуна", { weaponPower: 20, accuracy: 7, weight: 4 }, ["weapon.quick-recovery", "weapon.blood-seeker"]],
  ] },
  { classId: "secutor", setId: "secutor-arms", icon: "sword", variants: [
    ["common", "Строевой гладиус Секутора", { weaponPower: 12, accuracy: 0, weight: 13 }, []],
    ["good", "Гладиус преследователя", { weaponPower: 15, accuracy: 2, weight: 12 }, []],
    ["rare", "Клинок неотступного", { weaponPower: 18, accuracy: 4, weight: 11 }, ["weapon.counterweight"]],
    ["named", "Последний шаг", { weaponPower: 22, accuracy: 5, weight: 10 }, ["weapon.counterweight", "weapon.guard-breaker"]],
  ] },
  { classId: "hoplomachus", setId: "hoplomachus-arms", icon: "spear", variants: [
    ["common", "Простое копьё и щит", { weaponPower: 13, accuracy: 1, weight: 10 }, []],
    ["good", "Копьё строевого гоплита", { weaponPower: 16, accuracy: 3, weight: 9 }, []],
    ["rare", "Копьё первой шеренги", { weaponPower: 19, accuracy: 5, weight: 8 }, ["weapon.honed-edge"]],
    ["named", "Длинная тень Спарты", { weaponPower: 21, accuracy: 7, weight: 8 }, ["weapon.honed-edge", "weapon.deceptive-feint"]],
  ] },
];

const armorItemBlueprints = [
  { classId: "murmillo", setId: "murmillo-armor", icon: "armor", perkIds: ["armor.reinforced-lining", "armor.last-plate"], variants: [
    ["common", "Казарменный доспех Мурмиллона", { armor: 12, weight: 14, mobility: -4 }],
    ["good", "Усиленный доспех Мурмиллона", { armor: 16, weight: 13, mobility: -3 }],
    ["rare", "Броня старшего щитовика", { armor: 20, weight: 12, mobility: -2 }],
    ["named", "Стена Помпей", { armor: 24, weight: 11, mobility: -1 }],
  ] },
  { classId: "thraex", setId: "thraex-armor", icon: "greaves", perkIds: ["armor.flexible-joints", "armor.balanced-straps"], variants: [
    ["common", "Простой доспех Фракийца", { armor: 8, weight: 8, mobility: 2 }],
    ["good", "Подогнанный доспех Фракийца", { armor: 11, weight: 7, mobility: 3 }],
    ["rare", "Поножи быстрого клинка", { armor: 14, weight: 6, mobility: 4 }],
    ["named", "Шкура Диониса", { armor: 17, weight: 5, mobility: 6 }],
  ] },
  { classId: "retiarius", setId: "retiarius-armor", icon: "shoulder", perkIds: ["armor.sand-seals", "armor.flexible-joints"], variants: [
    ["common", "Простой галерус Ретиария", { armor: 4, weight: 3, mobility: 6 }],
    ["good", "Клёпаный галерус", { armor: 7, weight: 3, mobility: 7 }],
    ["rare", "Галерус песчаного ловца", { armor: 10, weight: 2, mobility: 8 }],
    ["named", "Плечо Тритона", { armor: 13, weight: 2, mobility: 10 }],
  ] },
  { classId: "secutor", setId: "secutor-armor", icon: "helmet", perkIds: ["armor.closed-visor", "armor.layered-padding"], variants: [
    ["common", "Строевой доспех Секутора", { armor: 13, weight: 15, mobility: -5 }],
    ["good", "Закрытый доспех Секутора", { armor: 17, weight: 14, mobility: -4 }],
    ["rare", "Броня охотника за сетью", { armor: 21, weight: 13, mobility: -3 }],
    ["named", "Лик Немезиды", { armor: 25, weight: 12, mobility: -2 }],
  ] },
  { classId: "hoplomachus", setId: "hoplomachus-armor", icon: "greaves", perkIds: ["armor.balanced-straps", "armor.layered-padding"], variants: [
    ["common", "Простой доспех Гопломаха", { armor: 9, weight: 9, mobility: 1 }],
    ["good", "Доспех копейной стойки", { armor: 12, weight: 8, mobility: 2 }],
    ["rare", "Поножи первой шеренги", { armor: 16, weight: 7, mobility: 3 }],
    ["named", "Доспех Леонида", { armor: 19, weight: 7, mobility: 4 }],
  ] },
];

const weaponItems = weaponItemBlueprints.flatMap((blueprint) => blueprint.variants.map(
  ([quality, name, stats, additionalPerkIds]) => ({
    id: `${blueprint.setId}.${quality}`,
    classId: blueprint.classId,
    setId: blueprint.setId,
    slot: "weapon",
    quality,
    name,
    icon: blueprint.icon,
    stats,
    additionalPerkIds,
  }),
));

const armorItems = armorItemBlueprints.flatMap((blueprint) => blueprint.variants.map(
  ([quality, name, stats], index) => ({
    id: `${blueprint.setId}.${quality}`,
    classId: blueprint.classId,
    setId: blueprint.setId,
    slot: "armor",
    quality,
    name,
    icon: blueprint.icon,
    stats,
    additionalPerkIds: index < 2 ? [] : [blueprint.perkIds[index - 2]],
  }),
));

globalThis.GladiatorReferenceData = {
  classes, weapons, armor, perks, qualities, weaponItems, armorItems,
};
})();
