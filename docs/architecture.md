# DOZESTICKER - Arquitetura

Versao atual: 0.5.2

## Objetivo

O DOZESTICKER nasce como um produto multi-album dentro da plataforma DOZEDEV Studio. A fundacao nao e especifica da Copa do Mundo 2026; ela permite criar catalogos para futebol, esportes, entretenimento e outras colecoes sem alterar a estrutura central.

## Arquitetura multi-album

A hierarquia principal e:

```text
collections -> albums -> sections -> stickers
```

Essa separacao permite:

- Uma colecao possuir varios albuns.
- Um album possuir varias secoes.
- Uma secao organizar figurinhas por tema, selecao, pagina ou bloco editorial.
- Novos tipos de colecao surgirem sem novas tabelas especificas por produto.

Na Sprint 03 foi adicionada a tabela `dozesticker.user_stickers`, separada do catalogo. Essa tabela guarda somente o estado minimo de posse por utilizador: `has_sticker`.

Exemplos suportados pela mesma estrutura:

- Copa do Mundo.
- Champions League.
- Euro.
- Copa America.
- Brasileirao.
- Libertadores.
- Pokemon.
- Dragon Ball.
- NBA.
- Formula 1.
- Marvel.
- Disney.

## Isolamento por schema

Todos os objetos proprietarios do DOZESTICKER ficam no schema `dozesticker`.

Esse isolamento evita colisao com outros produtos da plataforma, simplifica auditoria, facilita permissoes e reduz o risco de alterar estruturas globais por engano.

Regra permanente:

- Nao criar objetos do DOZESTICKER no schema `public`.

## Integracao com DOZEDEV Studio

O DOZESTICKER deve usar o mesmo projeto Supabase do DOZEDEV Studio.

Motivos:

- Evita custos de um novo projeto Supabase.
- Mantem identidade e autenticacao centralizadas.
- Facilita operacao multi-produto.
- Permite evolucao futura com padroes compartilhados entre DOZECLIN, DOZEMEC e demais sistemas.

## Autenticacao compartilhada

Usuarios nao sao duplicados.

A fundacao reutiliza:

- `auth.users`
- JWT do Supabase
- Infraestrutura de autenticacao ja existente na plataforma

Nesta Sprint, somente `import_jobs.created_by` referencia `auth.users(id)`, porque importacoes futuras precisarao registrar autoria administrativa.

Na Sprint 03, `user_stickers.user_id` tambem referencia `auth.users(id)` para isolar a colecao pessoal sem duplicar usuarios.

## Seguranca

Todas as tabelas usam Row Level Security.

Nesta Sprint:

- Leitura e permitida apenas para catalogos ativos.
- Escrita por utilizadores comuns nao e permitida.
- Escrita fica restrita a perfis administrativos detectados por `dozesticker.is_platform_admin()`.
- Na tabela `user_stickers`, o utilizador autenticado pode ler e alterar somente os seus proprios registros.

Observacao importante: a funcao administrativa usa papeis comuns em `app_metadata` (`admin`, `super_admin`, `platform_admin`). Antes de aplicar em ambiente real, alinhar esses nomes ao padrao exato usado no DOZECLIN.

## Escalabilidade futura

Melhorias recomendadas para Sprints futuras, sem implementacao nesta etapa:

- Criar tabela de colecao do utilizador isolada por `user_id`.
- Criar modelo para repetidas, coladas e trocas completas quando o MVP pedir.
- Definir processo de importacao CSV com staging e validacao.
- Criar views ou RPCs de leitura para dashboard real.
- Padronizar roles administrativas com a fonte oficial da plataforma.
- Definir estrategia para armazenamento de imagens sem usar assets oficiais protegidos.

## Modo Feira e offline

Na versao 0.4.0, `feira.html` passa a ser a tela operacional para eventos. Ela nao depende de menus grandes nem de cards completos, reduzindo o fluxo a pesquisa, contadores e lista de faltantes.

O estado de posse e gravado localmente primeiro para garantir resposta imediata. Quando Supabase estiver configurado com sessao autenticada, alteracoes feitas offline entram em uma fila local e sao sincronizadas automaticamente quando o navegador voltar ao estado online.

## Catalogo e navegacao do album

Na versao 0.5.0, `album.html` passa a representar a experiencia de navegacao do album fisico. A tela combina navegacao por secoes, pesquisa global em memoria, filtros rapidos e progresso por album/secao.

O catalogo e carregado uma vez pelo `collection.service.js` e mantido em cache interno. Pesquisas e filtros operam sobre esse cache, evitando chamadas repetidas ao Supabase a cada caractere digitado.

Os componentes reutilizaveis adicionados sao:

- `AlbumNavigation`
- `ProgressBar`
- `SearchBar`
- `SectionHeader`
- `StickerCard`

Os novos campos de catalogo foram modelados no frontend para preparar a importacao oficial da v0.6.0. A mudanca fisica da tabela `dozesticker.stickers` ainda depende de migration futura autorizada.

Complemento da Sprint 05:

- `assets/js/data/world-cup-2026.catalog.js` centraliza a referencia provisoria.
- `WORLD_CUP_2026_TEAMS` contem 48 selecoes em 12 grupos.
- `createTeamStickers()` gera 20 posicoes por selecao.
- `createFallbackWorldCupCatalog()` monta o catalogo operacional com 960 figurinhas de selecoes, INTRO00, 19 FWC e 12 CC.
- O album declara total operacional definitivo de 992 figurinhas.
- Epic Silver e Legendary Gold nao fazem parte do catalogo operacional e sao filtradas antes de calculos, pesquisa, Feira e sincronizacao.
- MUS e Atualizacoes nao aparecem na navegacao nem nos cards locais.
- FWC e INTRO sao especiais/raras; as posicoes 1 e 13 de todas as selecoes sao raras e exibem estrela no card.
- `collection.service.js` usa a regra de compatibilidade futura: catalogo remoto com registros substitui o fallback local; caso contrario, o fallback permanece ativo.
- Pesquisa e filtros continuam em memoria depois do primeiro carregamento.

Complemento da Sprint 05.2:

- Colecao, Feira, Modo Troca e Album usam agrupamento visual por secao/selecao.
- A ordenacao dos grupos vem de `sections.display_order`; a ordenacao interna das figurinhas vem de `display_order` e `number`.
- O agrupamento e montado em memoria a partir do catalogo ja carregado, sem chamadas repetidas ao Supabase por selecao.
- Cada grupo exibe quantidade obtida, percentual e barra de progresso propria.
