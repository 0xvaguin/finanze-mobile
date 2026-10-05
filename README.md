# Finanze Mobile

App de finanças pessoais (React Native + Expo, BRL, pt-BR). Dados 100% locais em SQLite.

## Estado: Entrega C (completa)
App Expo com login local (nome + PIN + biometria), Início, Extrato, Investimentos, simulador, backup/importação e branding.

| Entrega | Conteúdo | Status |
|---|---|---|
| A | Domínio, repositório SQLite, migrações, backup/importação, CSV, simulador, testes | pronta |
| B | Projeto Expo, tema, navegação, Dashboard, Extrato, formulário, copiar mês anterior, Configurações | pronta |
| C | Login local (PIN/biometria), Investimentos + histórico, simulador, exportar/importar, apagar dados, branding | pronta |

## Rodar
```
npm install --legacy-peer-deps
npm run typecheck   # domínio + app
npm test            # 181 testes
npx expo start      # abra no Expo Go (Android)
```

## Estrutura
- `src/domain/` regras puras (dinheiro em centavos, datas locais, validação, resumo, CSV, simulador, carteira, backup)
- `src/data/` `FinanceRepository` (contrato), `SqlFinanceRepository`, migrações por `PRAGMA user_version`
- `src/data/expoSqliteDriver.ts` adaptador de produção sobre expo-sqlite (typecheck ok; **não executado em dispositivo**)
- `app/` telas (expo-router); `src/ui/` tema e componentes; `src/state/` provider do repositório
- `tests/` Jest; SQLite real via sql.js; fuso fixo America/Sao_Paulo

## Regras-chave
- Valores sempre em centavos inteiros; nunca float (exceto o simulador).
- Data = data de calendário local `YYYY-MM-DD`; nunca `toISOString()` para "hoje".
- Importação só substitui tudo, valida o arquivo inteiro antes de gravar, em transação.
- Orçamento usado exclui a categoria Investimentos; o saldo a inclui.

## Login local
Cadastro de nome + PIN de 6 dígitos (+ biometria opcional). O perfil e o hash do PIN ficam no chaveiro do aparelho (expo-secure-store), fora de backups. 5 erros seguidos bloqueiam 30 s, escalando até 15 min. O app volta bloqueado após 1 min em segundo plano e esconde o conteúdo no seletor de apps. **Protege a abertura do app, não criptografa o banco.** Não há recuperação de PIN: "Esqueci meu PIN" apaga os dados e cria novo perfil (restaure por backup). Na Web o login é desativado.
