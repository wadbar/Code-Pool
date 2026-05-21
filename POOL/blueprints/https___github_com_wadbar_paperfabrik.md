# Blueprint Repositório: https://github.com/wadbar/paperfabrik

# METADADOS
- **Main Programming Language**: React TypeScript
- **License Type**: MIT ou Indefinida
- **Project Purpose Summary**: ...

## Padrão Arquitetural e Fluxo de Estruturação
O projeto segue uma arquitetura altamente modular e modularizada, focada em separação de interesses (separation of concerns), facilitando ingestão deterministicamente.

### Estrutura de Diretórios Detectada
```text
/server.ts
/src/App.tsx
/src/components/AIChatPanel.tsx
/src/components/FabricationPanel.tsx
/src/components/GlobalErrorBoundary.tsx
/src/components/Header.tsx
/src/components/Sidebar.tsx
/src/components/SystemHealthMonitor.tsx
/src/components/TerminalOverlay.tsx
/src/components/Viewports/3DPrintingViewport.tsx
/src/components/Viewports/BIMViewport.tsx
/src/components/Viewports/CADViewport.tsx
/src/components/Viewports/CNCRouterViewport.tsx
/src/components/Viewports/CircuitViewport.tsx
/src/components/Viewports/HYWorldViewport.tsx
/src/components/Viewports/OpenSCADViewport.tsx
/src/components/Viewports/PBRTexturingViewport.tsx
/src/components/Viewports/PackagingViewport.tsx
/src/components/Viewports/PhotogrammetryViewport.tsx
/src/components/Viewports/TinkercadViewport.tsx
/src/core/computeClient.ts
/src/core/geometry.ts
/src/core/logger.ts
/src/core/mesh.ts
/src/core/simulation.ts
/src/hooks/useTelemetry.ts
/src/lib/i18n.tsx
/src/lib/utils.ts
/src/main.tsx
/src/services/aiService.ts
/src/workers/compute.worker.ts
/vite.config.ts

```

### Tecnologias e Dependências Principais
Baseado na análise de código estático do ecossistema AI Studio integrado, o projeto incorpora facilidades para:
- Desenvolvimento moderno com React TypeScript.
- Estruturação desacoplada de dados para consumo no Lego-Pool.
- Organização nativa de componentes auxiliares e utilitários resilientes de runtime.