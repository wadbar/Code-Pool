# Gerenciador de Repositórios (Lego Pool Engine)

Uma plataforma robusta para ingestão, rastreamento, auditoria e indexação de conhecimento de repositórios open-source.

## Recursos
- **Ingestão Automatizada**: Clona e monitora repositórios GitHub.
- **Hungry Pool Engine**: Busca autônoma por repositórios relacionados e forks.
- **Modularidade**: Decomposição de código em blocos procedimentais.
- **Docker-ready**: Dockerfile configurado para produção.
- **Segurança**: Integração com Git para backup remoto.

## Stack
- Vite + React + TailwindCSS
- Express Backend (Node.js)
- TypeScript

## Como começar
1. Instale dependências: `npm install`
2. Configure `.env`: (`cp .env.example .env`) e adicione seu `GEMINI_API_KEY`.
3. Inicie em modo de desenvolvimento: `npm run dev`

## Estrutura
- `/POOL/modules`: Módulos de arquitetura (IA, Auth, Proc, etc).
- `/server/routes`: Rotas da API.
- `/server/utils`: Utilitários (Logging).
