# @wadbar/lego-pool - Master Map & Registry

O Pool de Códigos foi consolidado e otimizado. **Padrão Mono-Resource**: todos os recursos são focados em suas respectivas finalidades técnicas, sem manter laços com os projetos de origem.

## 🧱 Lego Bricks Disponíveis (Indexados em `/POOL/modules/`)

### 🤖 Inteligência Artificial (`@pool/AI`)
- [x] **GeminiBridge**: Motor unificado de GenAI e prompts estruturados.
- [ ] *Vision-Bridge: Processamento de imagens e assets (planejado).*

### 🛡️ Segurança & Autenticação (`@pool/AUTH`)
- [x] **AuthShield**: Geração/Verificação JWT, Proteção de API.
- [x] **kernelRateLimiter**: Bloqueio DDoS padrão (Express).
- [ ] *Cloud-Bridge: Conectores S3 e Storage (planejado).*

### ⚙️ Engenharia & Automação (`@pool/AUTOMATION`)
- [x] **SSHCommander**: Motor universal de execução SSH remota.
- [x] **RepoIngester**: Pipeline de ingestão, clonagem e decomposição IA.
- [x] **UpdateManager**: Motor de sincronização cíclico e watchlist.
- [x] **HungryPoolEngine**: Orquestrador autônomo que caça rotinas e open-code pelo Github.
- [ ] *Socket-Hub: Orquestração Real-time unificada (planejado).*

### 🎬 Media & Streaming (`@pool/MEDIA`)
- [x] **StreamEngine**: Pipeline VLC/XBMC-like para gerenciamento de fluxos HLS/DASH/Raw.
- [x] **ContentScraper**: Scraping e indexação paralela inspirado no CocoScrapers/Kodi.
- [x] **TorrentScraper**: Extração resiliente de links magnéticos inspirada no `levyvix/scraper-filmes`.

### 🗄️ Engenharia de Dados & DW (`@pool/DATA`)
- [x] **DataSink**: Ingestão em lote e pipeline de BigQuery para dados estruturados.

### 🔍 Busca & Dark Web (`@pool/SEARCH`)
- [x] **DistributedIndex**: Engine B-Tree/Vetorial inspirado no OpenSearch.
- [x] **WebCrawler**: Deep Spider (Tor-friendly) baseado nas táticas do Torch.
- [x] **GitHubSpider**: Rastreador de grafos do GitHub (Forks, Relacionados) para alimentar o ecossistema.

### 📐 Geometria, CAD & 3D (`@pool/GEOMETRY`)
- [x] **MeshProcessor**: Decimation e Vertex Normal calc inspirado no Blender, MeshLab e Open3D.
- [x] **ParametricCAD**: Parsers CSG/BREP e solver de sketchs inspirado no FreeCAD e OpenSCAD.
- [ ] *Headless-Renderer: Backend WebGL (Chromium/Three.js-like) (planejado).*

### 👁️ Nuvem de Pontos e Fotogrametria (`@pool/VISION`)
- [x] **PhotogrammetryPipeline**: MVS (Multi-View Stereo) e SfM inspirado em AliceVision/Meshroom.

### 🌍 Geração Procedural (`@pool/PROCEDURAL`)
- [x] **WorldGenerator**: Geração 3D, noise mapping e asset scatter inspirado em Houdini GDT e HY-World-2.0.

## 🔄 Monitoramento, Sincronização & Expansão (A Piscina Faminta 🦈)
A Piscina (Lego Pool) possui um motor de sincronização global continuo que vigia alterações e insere novos repositórios:
- **Registry**: Configurado em `/POOL/pool-registry.json` listando todos os repositórios fonte indexados (que originaram as pecinhas acima).
- **Adição Automática**: Qualquer novo repositório chamado na API `/api/pool/ingest` entrará na vigilância.
- **Sincronização em Massa**: `/api/pool/sync` força a leitura e decomposição de quaisquer commits novos nos repositórios, consolidando as mudanças (atualizando ou criando novos blocos).
- **Hungry Hunt**: `/api/pool/hunt` ativa o instinto predador. A `HungryPoolEngine` usa o `GitHubSpider` para vasculhar ramificações, `forks` e ecossistemas open-source baseada no seu catálogo atual para crescer e adicionar inteligência ao pool sem ação manual!

## 🚀 Como Integrar nos Projetos
O Pool agora suporta Path Aliases (TypeScript). Você pode importar blocos diretamente de qualquer local:

```typescript
import { GeminiBridge } from "@pool/AI";
import { SSHCommander } from "@pool/AUTOMATION";
import { AuthShield } from "@pool/AUTH";
```
