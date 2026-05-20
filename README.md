# 📦 Lego Pool Engine - Ecossistema do Conhecimento

Uma arquitetura de engenharia de software de alta performance, projetada como um compilador determinístico para ingestão, rastreamento, auditoria estática e indexação modular de conhecimento de repositórios reais. 

Este ecossistema opera manipulando o Git em tempo real, varrendo o disco físico por modificações no diretório `/POOL` e indexando blocos lógicos autônomos prontos para produção.

---

## 🚀 Como Rodar Localmente no seu PC (Passo a Passo)

### 1. Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- **Node.js** (Versão `>= 18.0.0`, recomendado v20 ou v22 LTS)
- **Git** (Instalado e configurado com seu e-mail e nome globalmente)
- **NPM** (Geralmente vem integrado ao Node)

---

### 2. Clonar e Instalar Dependências
No seu terminal local, execute:
```bash
# Clone o repositório do seu ecossistema para a sua máquina
git clone <URL-DO-SEU-REPOSITORIO>

# Entre na pasta raiz
cd lego-pool

# Instale os pacotes e dependências (o NPM resolverá as dependências nativas e patches)
npm install
```

---

### 3. Configurar Variáveis de Ambiente (`.env`)
Duplique o arquivo de exemplo para criar a sua configuração local:
```bash
cp .env.example .env
```
Abra o arquivo `.env` gerado e configure as variáveis reais:
```env
# Sua chave secreta do Gemini AI (usada pelos Workers/Scanner de Inteligência do Pool)
GEMINI_API_KEY="AIzaSy..."

# URL onde seu servidor vai rodar localmente (padrão do Applet)
APP_URL="http://localhost:3000"

# Segredo para autenticação e assinatura de sessões JWT locais
JWT_SECRET="sua_chave_secreta_e_robusta_aqui"

# Integrações opcionais do GitHub OAuth se desejar autenticação externa
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

---

### 4. Inicializar em Modo de Desenvolvimento
Inicie o ecossistema com um único comando:
```bash
npm run dev
```
O servidor começará a escutar em **`http://localhost:3000`**.
O terminal reportará a inicialização automática de todos os daemons secundários em background:
- **`worker_ingest`**: Monitora filas e faz a ingestão real de repositórios descompactados ou links.
- **`worker_blueprints`**: Processa a extração analítica das regras de negócio.
- **`ScannerAgent`**: Realiza varreduras assíncronas no disco a cada 5 segundos buscando mutações.
- **`Auto-Commit Gradual`**: Detecta e registra de forma distribuída modificações na piscina a cada 15 segundos para evitar sobrecargas de CPU/IO.

---

## 🛠️ Arquitetura e Estrutura de Diretórios Locals

Quando rodar o app localmente, a estrutura física do ecossistema se assentará em seu diretório de execução:
- 📁 `POOL/` - O núcleo físico de persistência dos módulos.
  - 📁 `modules/` - Todas as categorias lógicas de blocos ts puros extraídos (ex: `AI`, `DB`, `AUTH`).
  - 📁 `blueprints/` - Lógicas de modelagem e arquiteturas deduzidas.
  - 📄 `worker-status.json` - Controle de estado em tempo real (Pause/Run) usado pelos subprocessos.
  - 📄 `git-config.json` - Configuração da salvaguarda remota vinculada pelo painel administrativo.
- 📁 `packages/` - Modificações de baixo nível e patches locais de dependências do ecossistema.
- 📁 `src/` - Interface gráfica rica (Vite + React + Tailwind + Motion).
- 📄 `server.ts` - Core HTTP Express + Gateways de Comunicação Físicos + Orquestrador de Processos de Auto-Cura.
- 📄 `ingest.log` / `blueprints.log` / `system.log` - Documentação física de logs em tempo real que você pode ler no seu PC.

---

## 🔄 Fluxo de Trabalho Sem Falso Funcionamento (Real & Robusto)

1. **Gestão de Daemons Físicos (Graceful Recovery)**:
   Se em algum momento um processo do node falhar localmente ou for encerrado pelo sistema operacional, o core de auto-cura (`checkAndResurrectDaemons`) o re-erguerá de forma transparente na próxima requisição do painel de controle.
2. **Auto-Cura do Git local**:
   Se a pasta `.git` estiver corrompida localmente, o servidor inicializará um repositório git limpo, configurará o usuário administrativo (`Lego Pool Bot`), gerará o primeiro index e manterá a integridade do banco de arquivos intacta.
3. **Mecanismo de Salvaguarda de Backup Remoto (Instant Push)**:
   - Vincule a URL do seu repositório de backup persistente no Github no painel de controle (`Sincronia Remota`).
   - Insira o seu Token de Acesso Pessoal (PAT) do GitHub.
   - O ecossistema fará o commit distribuído localmente de forma automática e, caso a flag de `Auto-Push` esteja ativa, subirá as alterações instantaneamente e de forma forçada (`force-push`) para a branch selecionada sob total fidelidade.
4. **Resolução de Conflitos e Travamentos Locais**:
   Se algum daemon local travar ou a fila ficar ociosa devido a arquivos temporários órfãos de processos anteriores, utilize os botões:
   - **Purge Temporary Directory** (Apaga caches locais com segurança).
   - **Limpar Logs Globais** (Limpa arquivos `.log` do disco).
   - **Restart Workers** (Força o encerramento de processos mortos via `kill_stuck.js` e inicia daemons limpos).

---

## 💎 Comandos do Console Administrativo Local

Use estas ferramentas de linha de comando úteis para operar o sistema por fora do painel web se desejar:

- **Iniciar logs em tempo real**:
  ```bash
  tail -f system.log -f ingest.log
  ```
- **Limpar todos os artefatos compilados temporários**:
  ```bash
  npm run clean
  ```
- **Auditoria de Tipagem Estática do TypeScript**:
  ```bash
  npm run lint
  ```
