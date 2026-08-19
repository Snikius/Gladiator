# Промпты атласа ретиария V1–V2

Все строки сгенерированы встроенным ImageGen отдельно и только по одному
референсу:
`prototypes/battle-arena/assets/unified-retiarius-character-reference-v1.png`.

## Общая часть каждого промпта

```text
Use case: stylized-concept
Asset type: source row for a frame-by-frame 2D game sprite atlas
Input images: Image 1 is the only canonical identity reference. Preserve exactly
the same right-facing retiarius: face, short dark hair, athletic proportions,
bronze shoulder guard and segmented arm armor, dark teal cloth, belt, greaves,
sandals, straight wooden trident with exactly three symmetric aligned prongs,
and compact weighted net in the armored hand.
Style/medium: dark gritty high-quality 16-bit/32-bit pixel art, crisp hard pixel
clusters, strong near-black outer contour, same palette, lighting and apparent
pixel density as Image 1.
Composition/framing: exactly six distinct consecutive full-body figures in one
horizontal left-to-right row, evenly spaced, all facing right, identical identity
and scale. Fixed ground baseline and root where the state permits. Wide empty
outer margins; entire head, feet, net, shaft and all trident tips visible.
Scene/backdrop: genuinely transparent background.
Constraints: six figures only; equipment baked into every silhouette; one straight
trident with exactly three prongs and one compact uncast net per frame; natural
grips; no grid, labels, numbers, text, floor, shadow, border or watermark.
Avoid: cropping, adjacent overlap, bent trident, extra/missing prongs, cast net,
duplicated limbs, detached equipment, body-size drift, white halo, blurry
antialiasing and painterly rendering.
```

## Задания строк

| Строка | Клип | Дополнение к общей части |
|---:|---|---|
| 0 | `idle.normal` | Минимальное дыхание и перенос веса; стопы неподвижны; кадры 0 и 5 образуют плавный loop. |
| 1 | `idle.tired` | Плечи и трезубец слегка опущены, колени мягче, медленное тяжёлое дыхание; без ранения и ходьбы. |
| 2 | `idle.injured` | Защитный наклон и щадящая стойка на одной ноге; остаётся стоять, не падает и не выпускает экипировку. |
| 3 | `attack` | Готовность → отвод → начало шага → полный прямой укол вправо → возврат → готовность; сеть не бросается. |
| 4 | `defense.block` | Готовность → реакция → диагональный подъём трезубца → контактное парирование → отдача → возврат; щита нет. |
| 5 | `defense.dodge` | Готовность → обнаружение атаки → отклонение назад → глубокий уход без падения → подъём → восстановление. |
| 6 | `reaction.hit` / `defeated` | Кадры 0–2: только нелетальная отдача стоя. Кадры 3–5: подгибание коленей → падение → полностью лежащая финальная поза. |
| 7 | `advance` / `retreat` | Осторожный шестикадровый боевой шаг вправо с малым вертикальным движением; обратное проигрывание используется для отхода. |
| 8 | `greeting` | Готовность → выпрямление → диагональный салют трезубцем на уровне плеча/головы → короткое удержание → опускание → готовность. Масштаб тела и baseline во всех кадрах неизменны; вертикальный трезубец над головой запрещён. |
| 9 | `victory` | Готовность → гордая стойка → диагональный подъём → высокий салют вправо-вверх → триумф → удерживаемая финальная поза. Масштаб тела и baseline неизменны; вертикальный трезубец над головой запрещён. |
| 10 | `special` | Классовый бросок сети: готовность → замах сетью → горизонтальное вращение → компактное раскрытие сети вправо → возврат сети → готовность. Сеть соединена верёвкой с рукой; трезубец остаётся опущенным и не атакует. |

Для строк 1 и 9 первые варианты были отклонены из-за касания внешних границ.
Принятые варианты повторно сгенерированы в меньшем масштабе с обязательными
широкими прозрачными полями.

Строка 8 обновлена до `source-v2`: первая версия поднимала длинный трезубец
вертикально, из-за чего упаковщик уменьшал тело примерно до 80% высоты обычной
стойки. V2 использует диагональный салют; сборщик отдельно проверяет медианную
высоту плотного силуэта приветствия относительно `idle.normal`.

Строка 9 также обновлена до `source-v2`: высокий диагональный салют сохраняет
читаемую победную позу, но не увеличивает общую высоту кадра длинным вертикальным
оружием. Та же проверка сравнивает масштаб победы с `idle.normal`.

Начиная с runtime V4 проблема решается системно: строки упаковываются в
физические ячейки 384×384 с логической областью тела 256×256. Масштаб считается
по плотному контуру тела, а тонкий трезубец и сеть могут занимать прозрачный
буфер и не участвуют в определении роста персонажа.

Runtime V5 добавляет одиннадцатую строку `special`. Она сгенерирована тем же
встроенным ImageGen по единственному каноническому референсу, после чего прошла
общую проверку плотной высоты тела, безопасных полей и связности силуэта. Бросок
сети остаётся дальним визуальным действием и не получает дополнительного
программного выпада по X.
