# DOZESTICKER - Banco de dados

Versao atual: 0.5.1

## Schema

Toda a fundacao do banco pertence ao schema `dozesticker`.

Objetos proibidos no schema `public` para este produto:

- Tabelas
- Enums
- Funcoes
- Triggers
- Views
- Indices
- Policies
- Procedures
- RPCs

O schema `auth` e reutilizado apenas para a relacao com `auth.users`, preservando a autenticacao compartilhada do DOZEDEV Studio.

## Enums

- `dozesticker.collection_status`: `draft`, `active`, `archived`.
- `dozesticker.album_status`: `draft`, `active`, `archived`.
- `dozesticker.section_status`: `active`, `inactive`.
- `dozesticker.sticker_status`: `active`, `inactive`.
- `dozesticker.import_status`: `pending`, `processing`, `completed`, `failed`.

## Tabelas

### `dozesticker.collections`

Representa grandes linhas de colecao, como Copa do Mundo, NBA, Pokemon ou Marvel.

Campos principais:

- `id`: UUID com `gen_random_uuid()`.
- `slug`: identificador unico.
- `name`: nome exibivel.
- `description`: texto opcional.
- `cover_image`: imagem opcional, ainda sem armazenamento implementado.
- `year`: ano da colecao, opcional.
- `status`: ciclo de vida da colecao.
- `created_at`, `updated_at`: auditoria basica.

### `dozesticker.albums`

Representa uma edicao especifica dentro de uma colecao.

Relacionamento:

- `collection_id` referencia `dozesticker.collections(id)`.

Campos principais:

- `slug`, `name`, `edition`, `country`, `language`.
- `total_stickers`: total previsto de figurinhas.
- `release_date`: data de lancamento opcional.
- `status`, `created_at`, `updated_at`.

### `dozesticker.sections`

Representa divisoes internas do album, como selecoes, escudos, estadios ou grupos tematicos.

Relacionamento:

- `album_id` referencia `dozesticker.albums(id)`.

Campos principais:

- `slug`, `name`.
- `display_order`: ordenacao visual.
- `status`, `created_at`, `updated_at`.

### `dozesticker.stickers`

Catalogo canonico das figurinhas de cada album.

Importante: esta tabela nao representa posse do utilizador. Colecao pessoal, repetidas e coladas pertencem a Sprints futuras.

Relacionamentos:

- `album_id` referencia `dozesticker.albums(id)`.
- `section_id` referencia `dozesticker.sections(id)`.

Campos principais:

- `code`, `number`, `title`, `subtitle`.
- `page`, `position`.
- `rarity`, `image_url`, `notes`.
- `status`, `created_at`, `updated_at`.

Campos planejados para a evolucao do catalogo oficial:

- `type`: tipo da figurinha.
- `country_code`: codigo do pais.
- `team_code`: codigo da selecao/time.
- `group_code`: grupo do album.
- `player_name`: nome do jogador, quando aplicavel.
- `player_number`: numero do jogador, quando aplicavel.
- `display_order`: ordem de exibicao no album.
- `is_special`: marca figurinhas especiais.
- `foil`: marca figurinhas metalizadas.

Na Sprint 05 esses campos foram preparados no modelo de catalogo em memoria e no servico de frontend. Nenhuma migration foi criada nesta Sprint, conforme criterio de aceite.

Complemento da Sprint 05.2: a fonte local provisoria gera 48 selecoes com 20 posicoes cada, totalizando 960 figurinhas de selecoes. A intro foi ajustada para `INTRO00`, a secao FWC possui 19 posicoes, a secao CC possui 12 posicoes, e o total operacional definitivo do album foi ajustado para 992 figurinhas. Epic Silver, Legendary Gold, MUS e Atualizacoes nao existem nos cards locais nem participam dos calculos. A tabela real ainda nao foi alterada.

Tipos planejados:

- `player`
- `team_photo`
- `logo`
- `badge`
- `stadium`
- `mascot`
- `trophy`
- `poster`
- `special`
- `promo`

### `dozesticker.import_jobs`

Prepara a fundacao para importacoes futuras de catalogo por CSV.

Relacionamentos:

- `album_id` referencia `dozesticker.albums(id)`.
- `created_by` referencia `auth.users(id)`.

Campos principais:

- `file_name`.
- `total_rows`, `processed_rows`, `imported_rows`.
- `status`.
- `started_at`, `finished_at`, `created_at`.

### `dozesticker.user_stickers`

Tabela adicionada na Sprint 03 para representar a colecao minima do utilizador.

Ela controla apenas:

- Tenho.
- Ainda nao tenho.

Nao controla quantidade, repetidas, estoque, coladas, entradas, saidas ou historico.

Relacionamentos:

- `user_id` referencia `auth.users(id)`.
- `sticker_id` referencia `dozesticker.stickers(id)`.

Campos principais:

- `id`: UUID com `gen_random_uuid()`.
- `user_id`: utilizador autenticado compartilhado com DOZEDEV Studio.
- `sticker_id`: figurinha do catalogo.
- `has_sticker`: booleano com `false` por padrao.
- `created_at`, `updated_at`: auditoria basica.

### `dozesticker.profiles`

Tabela adicionada na Sprint 05.1 para dados publicos e operacionais do perfil DOZESTICKER.

Ela nao duplica autenticacao: o identificador principal e o mesmo `auth.users.id`.

Campos principais:

- `id`: UUID referenciando `auth.users(id)`.
- `full_name`: nome exibivel do usuario.
- `username`: apelido opcional.
- `avatar_url`: imagem opcional.
- `status`: `active`, `blocked` ou `pending`.
- `created_at`, `updated_at`: auditoria basica.

Um trigger em `auth.users` cria o perfil automaticamente no schema `dozesticker` quando um novo usuario e cadastrado. A migration tambem faz backfill para usuarios ja existentes.

## Constraints

Unicidade:

- `collections.slug`.
- `albums.slug`.
- `sections(album_id, slug)`.
- `stickers(album_id, code)`.
- `user_stickers(user_id, sticker_id)`.
- `profiles(username)`, quando `username` existe.

Validacoes:

- `slug` e nomes obrigatorios nao podem ficar em branco.
- `collections.year >= 1900`, quando informado.
- `albums.total_stickers >= 0`.
- `sections.display_order >= 0`.
- `stickers.page >= 0`, quando informado.
- `stickers.position >= 0`, quando informado.
- `import_jobs.total_rows >= 0`.
- `import_jobs.processed_rows >= 0`.
- `import_jobs.imported_rows >= 0`.
- `import_jobs.processed_rows <= total_rows`.
- `import_jobs.imported_rows <= total_rows`.
- `import_jobs.finished_at >= started_at`, quando ambas as datas existirem.

## Indices

Criados para suportar busca, listagem e relacionamentos:

- `dozesticker.collections_slug_idx` em `collections(slug)`.
- `dozesticker.albums_collection_id_idx` em `albums(collection_id)`.
- `dozesticker.albums_slug_idx` em `albums(slug)`.
- `dozesticker.sections_album_id_idx` em `sections(album_id)`.
- `dozesticker.sections_display_order_idx` em `sections(display_order)`.
- `dozesticker.stickers_album_id_idx` em `stickers(album_id)`.
- `dozesticker.stickers_section_id_idx` em `stickers(section_id)`.
- `dozesticker.stickers_code_idx` em `stickers(code)`.
- `dozesticker.stickers_number_idx` em `stickers(number)`.
- `dozesticker.stickers_page_idx` em `stickers(page)`.
- `dozesticker.import_jobs_status_idx` em `import_jobs(status)`.
- `dozesticker.user_stickers_user_id_idx` em `user_stickers(user_id)`.
- `dozesticker.user_stickers_sticker_id_idx` em `user_stickers(sticker_id)`.
- `dozesticker.user_stickers_has_sticker_idx` em `user_stickers(has_sticker)`.
- `profiles_username_unique_idx` em `profiles(lower(username))`, quando `username` existe.
- `profiles_status_idx` em `profiles(status)`.

## Triggers

A funcao reutilizavel `dozesticker.touch_updated_at()` atualiza `updated_at` automaticamente.

Triggers criados:

- `collections_touch_updated_at`.
- `albums_touch_updated_at`.
- `sections_touch_updated_at`.
- `stickers_touch_updated_at`.
- `user_stickers_touch_updated_at`.
- `profiles_touch_updated_at`.
- `profiles_prevent_identity_change`.
- `on_auth_user_created` em `auth.users`, executando `dozesticker.handle_new_auth_user()`.

`import_jobs` nao possui `updated_at` nesta Sprint, conforme o escopo solicitado.

## RLS e policies

RLS fica habilitada em todas as tabelas:

- `collections`
- `albums`
- `sections`
- `stickers`
- `import_jobs`
- `user_stickers`
- `profiles`

Leitura publica/autenticada de catalogo:

- `Read active collections`: permite ler colecoes ativas.
- `Read active albums`: permite ler albuns ativos de colecoes ativas.
- `Read active sections`: permite ler secoes ativas de albuns e colecoes ativos.
- `Read active stickers`: permite ler figurinhas ativas de secoes, albuns e colecoes ativos.

Escrita administrativa:

- `Admins manage collections`.
- `Admins manage albums`.
- `Admins manage sections`.
- `Admins manage stickers`.
- `Admins manage import jobs`.

A funcao `dozesticker.is_platform_admin()` verifica papeis administrativos no JWT compartilhado do Supabase. Como o padrao DOZECLIN nao esta disponivel neste repositorio, os nomes de papeis devem ser revisados antes da aplicacao da migration.

Policies da colecao do utilizador:

- `Users read own stickers`: cada utilizador le apenas seus registros.
- `Users insert own stickers`: cada utilizador cria apenas seus registros.
- `Users update own stickers`: cada utilizador altera apenas seus registros.
- `Users delete own stickers`: cada utilizador remove apenas seus registros.
- `Admins manage user stickers`: perfis administrativos podem gerir registros quando o papel administrativo for validado.

Policies de perfil:

- `profiles_select_own`: cada usuario le apenas seu perfil.
- `profiles_update_own`: cada usuario altera apenas seus dados permitidos.
- `profiles_admin_manage`: perfis administrativos podem gerir perfis quando o papel administrativo for validado.

Usuarios comuns nao podem alterar `id` nem `status` do perfil.

## Seed

O arquivo `supabase/seed.sql` cria apenas:

- Colecao: `Copa do Mundo`.
- Album: `Copa do Mundo 2026`.

Nenhuma figurinha e importada nesta Sprint.
