# Finanze Mobile - Manual de instalação

Para rodar o app no seu celular Android durante o desenvolvimento (Expo Go). Os comandos servem para Windows (PowerShell), macOS e Linux.

## 1. O que você precisa
| Item | Versão | Como conferir |
|---|---|---|
| Node.js | 20 ou superior (testado com 22) | `node -v` |
| npm | 10 ou superior | `npm -v` |
| Celular Android | Android 8+ | - |
| Expo Go | a versão da Play Store compatível com o **SDK 57** | abra o app e veja a versão do SDK |
| Rede | celular e computador no **mesmo Wi-Fi** | - |

Instale o Node em https://nodejs.org (versão LTS). Não precisa de Android Studio.

## 2. Instalar o projeto
1. Extraia o arquivo `finanze-mobile-entrega-C.zip` em uma pasta, por exemplo `C:\Projetos\finanze-mobile`.
2. Abra o terminal **dentro dessa pasta**.
3. Instale as dependências:
   ```
   npm install --legacy-peer-deps
   ```
   (A flag evita conflitos de dependências entre pacotes do Expo. A instalação leva alguns minutos.)
4. Confira que tudo está íntegro:
   ```
   npm run typecheck
   npm test
   ```
   Esperado: sem erros de tipo e `Tests: 181 passed` (10 suítes).

## 3. Rodar no celular
1. Inicie o servidor:
   ```
   npx expo start
   ```
2. Um QR code aparece no terminal.
3. No celular, abra o **Expo Go** e escaneie o QR code (pela câmera do app, na aba "Scan QR code").
4. Na primeira abertura aparece o **cadastro**: nome, PIN de 6 dígitos (confirmação) e, se o aparelho tiver biometria, a opção de ativá-la. Depois o app abre vazio, sem dados de exemplo. Isso é esperado.

### Se o celular não conectar
- Confirme o mesmo Wi-Fi (redes "convidado" costumam bloquear).
- Libere o Node.js no firewall do Windows (aceite o aviso na primeira execução).
- Use o modo túnel: `npx expo start --tunnel` (pede para instalar um pacote auxiliar; aceite).
- Limpe o cache: `npx expo start -c`.
- Erro de versão do SDK no Expo Go: atualize o Expo Go pela Play Store.

## 4. Rodar na Web (somente conferir o visual)
```
npx expo start --web
```
Na Web o SQLite é experimental e **os dados podem não persistir**; exportar/importar não funcionam. Use o celular para validar de verdade.

## 5. Gerar um APK instalável (opcional)
Precisa de conta gratuita em https://expo.dev.
```
npx eas-cli login
npx eas-cli build -p android --profile preview
```
Ao terminar, o EAS mostra um link para baixar o `.apk`. O pacote provisório é `app.finanze.mobile`; altere em `app.json` antes de publicar na Play Store.

## 6. Checklist de validação no celular
Marque cada item ao testar (isso não foi possível automatizar):
- [ ] Primeira abertura: cadastro (nome → PIN → confirmar PIN → biometria opcional) e entrada no app com "Olá, <nome>".
- [ ] PIN fraco (`123456`, `111111`) é recusado; PINs diferentes na confirmação voltam ao início.
- [ ] Fechar e reabrir o app: pede o PIN (ou a biometria). PIN correto entra.
- [ ] 5 PINs errados seguidos: mensagem de bloqueio com contagem regressiva (30 s); com o PIN certo durante o bloqueio, continua bloqueado.
- [ ] Deixar o app em segundo plano por mais de 1 min e voltar: pede o PIN. No seletor de apps o conteúdo não aparece.
- [ ] Configurações > Segurança: ligar/desligar biometria, **Alterar PIN** (atual → novo → confirmar) e **Bloquear agora**.
- [ ] "Esqueci meu PIN" > digitar APAGAR: apaga dados e perfil e volta ao cadastro (só teste com dados de teste).
- [ ] O app abre sem tela de erro e mostra o estado vazio no Início.
- [ ] Criar uma despesa: valor, categoria, data, conta e descrição; aparece no Extrato e atualiza o saldo.
- [ ] Criar uma receita; saldo = receitas − despesas.
- [ ] Editar, **Repetir** e excluir (com confirmação) um lançamento.
- [ ] Lançamento com data futura mostra a pílula "Futuro".
- [ ] Criar um lançamento às 21h–23h59: a data padrão é a de **hoje** (não a de amanhã).
- [ ] Busca no Extrato acha "alimentacao" ao digitar sem acento.
- [ ] Definir orçamento em Configurações; aporte na categoria Investimentos **não** conta no orçamento.
- [ ] "Copiar do mês anterior" em um mês vazio.
- [ ] Cadastrar um ativo; aceitar (ou recusar) registrar o aporte no Extrato.
- [ ] Atualizar o valor de mercado duas vezes em dias diferentes: o gráfico mostra a evolução em degraus.
- [ ] Simulador: 12% ao ano mostra ≈ 0,95% ao mês; valores marcados como nominais.
- [ ] Exportar backup JSON, apagar todos os dados (digitando APAGAR) e **importar** o mesmo arquivo: tudo volta igual.
- [ ] Importar um arquivo qualquer (não-backup): mostra erro e não altera nada.
- [ ] Exportar CSV e abrir no Excel/Planilhas: acentos corretos, colunas separadas por `;`.
- [ ] Trocar o tema (Escuro/Claro/Sistema); textos legíveis nos dois.
- [ ] Fechar e reabrir o app: os dados continuam.

## 7. Backup e privacidade
- O **PIN e a biometria protegem a abertura do app**; eles **não criptografam** o banco de dados. Não existe recuperação de PIN. O PIN não entra no backup: ao restaurar em outro aparelho você cria um novo perfil e depois importa o backup.
- Os dados ficam **somente no aparelho**, sem criptografia do app e sem envio a servidores. O backup automático do Android está desligado.
- Trocou de celular ou vai desinstalar? **Exporte o backup JSON antes** e guarde em local seguro. Ele contém todo o histórico financeiro.
- Para restaurar: Configurações > Importar backup. A importação **substitui** os dados atuais e valida o arquivo inteiro antes de gravar.

## 8. Problemas comuns
| Sintoma | O que fazer |
|---|---|
| `npm install` falha por conflito (`ERESOLVE`) | use `npm install --legacy-peer-deps` |
| "Não foi possível abrir seus dados" | feche e reabra o app; se persistir, reinstale o Expo Go |
| Tela branca ao abrir | `npx expo start -c` e escaneie o QR de novo |
| Biometria não aparece | cadastre digital/rosto nas configurações do Android; a opção só surge se houver biometria cadastrada |
| Esqueci o PIN | use "Esqueci meu PIN" (apaga os dados) e depois importe seu backup |
| Exportar não abre o menu de compartilhar | verifique se há app de arquivos/e-mail; tente novamente |
