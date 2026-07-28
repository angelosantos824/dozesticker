# DOZESTICKER

Sistema web para controlar colecoes de figurinhas. O foco inicial e a Copa do Mundo 2026, mas a arquitetura deve suportar dezenas de albuns e colecoes sem alteracoes estruturais.

## Tecnologias

- HTML5
- CSS3
- JavaScript ES Modules
- Supabase Auth no projeto existente DOZEDEV Studio
- PWA preparada para evolucao futura

## Estrutura do projeto

- `index.html`: entrada publica do projeto.
- `login.html`, `cadastro.html`, `recuperar-senha.html`, `nova-senha.html`: fluxo de autenticacao.
- `dashboard.html`: painel visual da colecao do usuario autenticado.
- `colecao.html`: grade visual da colecao com filtros simulados.
- `faltantes.html`, `repetidas.html`, `pacotes.html`, `trocas.html`, `configuracoes.html`: modulos provisorios.
- `assets/css`: variaveis, reset, layout, componentes, responsividade e estilos de paginas.
- `assets/js`: inicializacao, componentes, configuracao e utilitarios.
- `assets/images`: identidade visual provisoria propria.
- `supabase/migrations`: migrations SQL nao aplicadas.
- `supabase/seed.sql`: seed inicial nao aplicado.
- `docs`: documentacao tecnica.
- `manifest.webmanifest` e `service-worker.js`: base PWA.

## Como executar localmente

Por usar JavaScript ES Modules, abra o projeto com um servidor local.

Opcao com Node.js, sem instalar dependencias:

```bash
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};http.createServer((req,res)=>{const clean=decodeURIComponent(req.url.split('?')[0]);let file=path.join(root,clean==='/'?'index.html':clean);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data)})}).listen(8000,'127.0.0.1',()=>console.log('http://127.0.0.1:8000'))"
```

Depois acesse:

```text
http://127.0.0.1:8000/dashboard.html
```

Tambem e possivel usar Live Server ou outro servidor estatico local.

## Estado da Sprint 01

Implementado:

- Identidade visual propria, sem assets oficiais de FIFA ou Panini.
- Navegacao lateral no desktop.
- Navegacao inferior no celular.
- Dashboard com dados simulados centralizados no JavaScript.
- Tela Minha colecao com pesquisa, filtros, seletor de selecao e 12 figurinhas simuladas.
- Paginas provisorias para modulos futuros.
- Componentes base para botoes, cards, badges, campos, filtros, modal, toast, empty state, barra de progresso e navegacao.
- Manifest e service worker basicos.
- Configuracao base de Supabase sem chaves reais.

## Estado da Sprint 02

Versao: 0.2.0

Implementado:

- Migration unica de fundacao: `supabase/migrations/20260729000100_dozesticker_foundation.sql`.
- Schema exclusivo `dozesticker`.
- Enums de status para colecoes, albuns, secoes, figurinhas e importacoes.
- Tabelas de catalogo: `collections`, `albums`, `sections`, `stickers`.
- Tabela de preparacao para importacao futura: `import_jobs`.
- Chaves primarias UUID com `gen_random_uuid()`.
- Foreign keys entre catalogos e referencia a `auth.users`.
- Unique constraints, check constraints e indices.
- Funcao reutilizavel de `updated_at`.
- Triggers de `updated_at`.
- RLS habilitada em todas as tabelas.
- Policies de leitura para catalogos ativos.
- Policies de escrita apenas para perfis administrativos.
- Seed inicial com colecao "Copa do Mundo" e album "Copa do Mundo 2026".
- Documentacao em `docs/database.md` e `docs/architecture.md`.

Nada foi aplicado no Supabase nesta Sprint.

## Estado da Sprint 03

Versao: 0.3.0

Implementado:

- Nova migration nao aplicada: `supabase/migrations/20260729000200_dozesticker_user_collection.sql`.
- Tabela `dozesticker.user_stickers` para controlar apenas `Tenho` / `Ainda nao tenho`.
- RLS e policies para cada utilizador visualizar e alterar somente seus proprios registros.
- Reuso da funcao `dozesticker.touch_updated_at()`.
- Servico `assets/js/services/collection.service.js` centralizando listagem, marcacao, remocao, pesquisa e estatisticas.
- Dashboard calculado automaticamente a partir do servico de colecao.
- Tela Minha colecao com catalogo, pesquisa, filtros combinados e cards de dois estados.
- Nova tela `troca.html`, focada em feira de troca, mostrando apenas figurinhas faltantes.
- Toast com acao `Desfazer` por 5 segundos.

O frontend usa Supabase quando a configuracao tiver URL e anon key do projeto DOZEDEV Studio. Tokens e usuarios sao gerenciados exclusivamente pelo Supabase Auth, sem armazenamento manual de senha ou token.

## Estado da Sprint 04

Versao: 0.4.0

Implementado:

- Nova tela principal de evento: `feira.html`.
- Layout compacto para celular, sem menu lateral, rodape ou cartoes pesados.
- Indicadores rapidos: Tenho, Faltam e Progresso.
- Campo de pesquisa sempre visivel.
- Lista exibindo somente figurinhas faltantes.
- Botao `Receber` com atualizacao imediata da lista e dos contadores.
- Toast com `Desfazer` por 5 segundos.
- Botao `Modo Feira` para ocultar informacoes secundarias.
- Foco automatico na pesquisa ao abrir.
- `Enter` marca a primeira figurinha filtrada.
- `Esc` limpa a pesquisa.
- Ultimas pesquisadas salvas localmente, com limite de 10.
- Indicador Online/Offline.
- Fila local de sincronizacao para alteracoes feitas offline.
- Service worker com cache basico da tela Feira e assets essenciais para PWA.

## Modo Feira

`feira.html` e a tela recomendada durante eventos. Ela prioriza velocidade: pesquisar, tocar em `Receber`, ver o item sair da lista e continuar a troca.

O modo fullscreen interno, ativado por `Modo Feira`, remove o cabecalho secundario e as ultimas pesquisas, mantendo apenas:

- Pesquisa.
- Contadores.
- Lista de faltantes.

## Funcionamento offline

O aplicativo usa armazenamento local para manter o estado `Tenho` / `Faltam` disponivel mesmo sem internet. Ao marcar uma figurinha offline, a alteracao e aplicada imediatamente na interface e adicionada a uma fila local.

Quando a conexao volta, `collection.service.js` tenta sincronizar automaticamente a fila com Supabase, desde que a configuracao real esteja disponivel.

## Fila de sincronizacao

A fila fica no armazenamento local e guarda a ultima alteracao pendente por figurinha. Isso evita enviar estados antigos se o utilizador marcar e desfazer rapidamente durante a feira.

Com Supabase ainda nao configurado, a fila permanece local e a experiencia continua funcional no celular.

## Estado da Sprint 05

Versao: 0.5.0

Implementado:

- Nova pagina principal de catalogo: `album.html`.
- Navegacao por secoes do album: INTRO, FWC, grupos A-L e CC.
- Fonte local provisoria centralizada em `assets/js/data/world-cup-2026.catalog.js`.
- Navegacao completa com 12 grupos e 48 selecoes.
- Geracao local de 20 posicoes por selecao, totalizando 960 figurinhas de selecoes.
- Abertura de grupos por `groupCode` e selecoes por `teamCode`.
- Layout profissional de figurinhas com codigo, nome e estado `Tenho` / `Falta`.
- Barra de progresso por album e por secao.
- Estatisticas automaticas: Total, Tenho, Faltam, %, Duplicadas.
- Duplicadas permanece visualmente preparada e sempre `0` nesta versao.
- Pesquisa global instantanea em memoria por codigo, codigo compacto, numero, jogador, selecao, grupo e secao.
- Filtros rapidos: Todas, Tenho, Faltam, Especiais, Metalizadas e Time.
- Cache interno de catalogo no `collection.service.js`, evitando consulta por pesquisa.
- Componentes reutilizaveis: `StickerCard`, `ProgressBar`, `AlbumNavigation`, `SectionHeader`, `SearchBar`.

Nenhuma migration nova foi criada nesta Sprint. Os novos campos planejados para `stickers` foram preparados no modelo em memoria e documentados para uma migration futura autorizada.

Complemento aplicado:

- Grupos A ate L possuem quatro selecoes cada.
- Cada selecao possui codigos de 1 ate 20, como `BRA1`, `BRA2`, `MEX20`.
- Como ainda nao existem nomes reais de jogadores, os titulos seguem o padrao `Brasil - Figurinha 1`.
- O total operacional definitivo do album foi ajustado para 992 figurinhas.
- O catalogo local possui 992 cards: 960 de selecoes, INTRO00, 19 FWC e 12 CC.
- Epic Silver e Legendary Gold nao fazem parte do catalogo operacional.
- MUS e Atualizacoes nao aparecem na navegacao nem nos cards locais.
- FWC e INTRO sao especiais/raras; as posicoes 1 e 13 de cada selecao sao raras e recebem estrela no card.
- Quando a Sprint 06 carregar o catalogo do Supabase, o catalogo remoto substituira o fallback local quando houver registros.
- `node scripts/validate-catalog.js` valida total 992, sequencias por selecao, FWC, INTRO, CC, duplicados e ausencia de Epic Silver/Legendary Gold.

## Estado da Sprint 05.1

Versao: 0.5.1

Implementado:

- Fluxo de login, cadastro, recuperacao de senha, nova senha e perfil.
- Auth centralizado em `assets/js/services/auth.service.js` usando Supabase Auth.
- Cliente Supabase centralizado em `assets/js/services/supabase-client.js`.
- Guard de rotas em `assets/js/auth/auth-guard.js`.
- Nova pagina `perfil.html` com nome, email, data de criacao, alteracao de nome, redefinicao de senha e sair.
- Navegacao por estado: visitantes veem Entrar/Criar conta; usuarios autenticados veem Dashboard, Album, Feira, Perfil e Sair.
- Colecao local e fila offline separadas por `user.id`.
- Fila offline com `id`, `userId`, `stickerId`, `hasSticker`, `createdAt` e `attempts`.
- Nova migration nao aplicada: `supabase/migrations/20260729000300_dozesticker_profiles.sql`.
- Tabela `dozesticker.profiles`, trigger em `auth.users`, RLS, policies, indices e grants sem criar objetos no schema `public`.

## Arquitetura Supabase

O DOZESTICKER deve usar obrigatoriamente o mesmo projeto Supabase do DOZEDEV Studio. Nao criar um novo projeto Supabase para este produto.

Diretrizes permanentes:

- Criar toda a estrutura do produto em um schema exclusivo chamado `dozesticker`.
- Nao criar tabelas no schema `public`.
- Criar funcoes, enums, triggers, views, indices e policies dentro do schema `dozesticker`.
- Manter isolamento logico entre DOZESTICKER e os demais produtos da plataforma DOZEDEV.
- Reutilizar `auth.users` e a infraestrutura de autenticacao ja existente.
- Nao duplicar usuarios em tabelas de autenticacao paralelas.

O arquivo `.env.example` documenta as variaveis previstas:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Como esta base ainda usa HTML puro sem processo de build, as variaveis Vite nao sao lidas diretamente pelo navegador. Para teste local, informe `url`, `anonKey` e `enabled: true` em `assets/js/config/supabase.js`; nao informe service role, senha, token de usuario ou qualquer segredo privado.

## Estrutura do banco

Hierarquia multi-album:

```text
dozesticker.collections
  -> dozesticker.albums
      -> dozesticker.sections
          -> dozesticker.stickers
```

Importacoes futuras:

```text
dozesticker.import_jobs -> dozesticker.albums
dozesticker.import_jobs.created_by -> auth.users
```

## Limitacoes atuais

- O catalogo oficial completo ainda nao foi importado.
- A autenticacao real depende da URL/anon key do projeto DOZEDEV Studio e da migration de perfis aplicada com autorizacao.
- A colecao do usuario sincroniza com Supabase quando configurado e autenticado; offline usa fila local por usuario.
- Nao ha upload, OCR, IA, scanner, marketplace, trocas, repetidas ou coladas.
- Nao ha importacao CSV funcionando.
- Nenhuma migration foi aplicada.
- Nenhum seed foi aplicado.
- Quantidade, repetidas e coladas continuam fora do MVP.
- QR Code, comunidade, eventos cadastrados, marketplace, chat, IA, scanner, OCR e compartilhamento continuam fora do escopo.

## Proximas Sprints

- Validar os papeis administrativos contra o padrao real do DOZECLIN.
- Aplicar a migration somente com autorizacao explicita.
- Trocar o catalogo local de demonstracao por catalogo vindo do Supabase assim que a migration for aplicada.
- Criar migration autorizada para os campos oficiais de `stickers`: `type`, `country_code`, `team_code`, `group_code`, `player_name`, `player_number`, `display_order`, `is_special`, `foil`.
- Implementar importacao do catalogo oficial da Copa do Mundo 2026 na v0.6.0.
- Criar fluxo de importacao CSV com validacao.
- Criar dashboard real via consultas, views ou RPCs no schema `dozesticker`.
- Evoluir pacotinhos, repetidas, coladas e trocas.
