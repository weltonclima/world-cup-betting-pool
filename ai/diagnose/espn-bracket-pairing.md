# Pareamento real da chave ESPN — verificado ao vivo (WC 2026)

> Fonte da verdade do pareamento pai→filho do mata-mata. Corrige a tabela errada
> que causou "Brasil/Canadá na chave errada" no TASK-09.
> Coleta: 2026-06-30, varredura `20260628-20260720` (scoreboard + core API matchNumber).

## Como a ESPN expõe o pareamento

1. **`matchNumber`** (core API `events/{id}/competitions/{id}`) → número oficial FIFA,
   estável, independe de resolução. `slotInRound = matchNumber − offset`:
   R32 off72 (slot 1–16) · R16 off88 (1–8) · QF off96 (1–4) · SF off100 (1–2) ·
   3º off102 (1) · Final off103 (1).
2. **Feeder por-lado** (`competitors[].team.displayName` = `"Round of 32 N Winner"`,
   `"Round of 16 N Winner"`, `"Quarterfinal N Winner"`, `"Semifinal N Winner/Loser"`).
   N = `slotInRound` do jogo-pai. **Some quando o lado vira time real** → só serve
   enquanto não-resolvido.
3. **Core API NÃO expõe feeder por `$ref`** (testado: competitor detail só tem
   `team/type/order/winner`; sem `previous`/`feeder`/`source`). Logo, para jogo com
   AMBOS os lados resolvidos, a única fonte é a tabela fixa abaixo (reconstruída).

## Tabela FIFA fixa (slot do filho → slots dos pais)

Reconstruída do feeder por-lado dos jogos não-resolvidos + de qual jogo cada time
classificado venceu. **Não é sequencial** `[2k],[2k+1]` — é a chave oficial cruzada.

```
R16 ← R32:  1:[2,5]  2:[1,3]  3:[4,6]  4:[7,8]
            5:[11,12] 6:[9,10] 7:[14,16] 8:[13,15]
QF  ← R16:  1:[1,2]  2:[5,6]  3:[3,4]  4:[7,8]
SF  ← QF:   1:[1,2]  2:[3,4]
Final ← SF: 1:[1,2]      3º ← SF (perdedores): 1:[1,2]
```

Cobertura R32: cada slot 1–16 aparece exatamente uma vez nos pais de R16. ✓

### Verificação (jogos resolvidos, 2026-06-30)

- R16 slot2 (mn90, `MAR @ CAN`) → CAN venceu R32 slot1 (`CAN @ RSA` mn73), MAR venceu
  R32 slot3 (`MAR @ NED` mn75) → `[1,3]` ✓
- R16 slot1 (mn89, `RD32 5 @ PAR`) → PAR venceu R32 slot2 (`PAR @ GER` mn74); away = R32 5
  → `[2,5]` ✓
- R16 slot3 (mn91, `RD32 6 @ BRA`) → BRA venceu R32 slot4 (`JPN @ BRA` mn76); away = R32 6
  → `[4,6]` ✓
- R16 slot4..8 lidos diretos dos feeders (ainda placeholders): `[7,8] [11,12] [9,10]
  [14,16] [13,15]` ✓
- QF/SF/Final/3º lidos diretos dos feeders (placeholders): conforme tabela ✓

### Erro anterior (corrigido)

Tabela do plano TASK-08: `1:[1,3] 2:[2,5] 5:[9,10] 6:[11,12] 7:[13,15] 8:[14,16]` —
slots **1↔2, 5↔6, 7↔8 trocados**. QF/SF/Final estavam certos.

## Estratégia anti-regressão (futuros jogos)

`resolveParentMatchIds` (bracket.ts) usa **híbrido**:
1. **Primário** — feeder por-lado da ESPN (`homeBracketSlot`/`awayBracketSlot`).
   Exato para qualquer jogo FUTURO/não-resolvido, sem depender da tabela. Enquanto a
   chave não estiver toda resolvida, a ESPN se autocorrige.
2. **Fallback** — tabela fixa acima, pelo `slotInRound` do próprio jogo. Só entra
   quando AMBOS os lados resolveram (feeder some). Verificada acima.

Assim, mesmo que a tabela tivesse um erro, ele só apareceria DEPOIS que ambos os lados
de um confronto resolvessem — e a ESPN já teria mostrado o feeder correto antes. Os
dois caminhos concordam onde ambos existem (T-08-01b cobre a precedência).
