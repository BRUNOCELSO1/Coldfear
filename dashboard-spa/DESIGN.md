Documentação Resumida — Design & UI/UX (Dashboard SPA)

1. Objetivo
- Entregar um dashboard com layout profissional, hierarquia visual clara e uma secção “Etapas” em formato Kanban para gerir clientes por estágio do funil.

2. Fundamentos de UI/UX Aplicados
- Hierarquia: títulos grandes (página), subtítulos, e dados numéricos (KPIs) com peso e tamanho maiores.
- Grid: base de 12 colunas com espaçamento consistente; KPIs se adaptam por breakpoint.
- Consistência: botões, inputs, cards e listas usam os mesmos tokens (cores, radius, sombras).
- Feedback: estados de hover/active/focus-visible; mensagens de erro inline com texto claro.
- Acessibilidade: foco visível, navegação por teclado, labels e aria em áreas críticas.

3. Breakpoints (Responsividade)
- Desktop: >= 1200px
  - KPIs em 3 colunas por card (até 4 por linha, dependendo do ecrã)
  - Kanban com 6 colunas visíveis e scroll horizontal quando necessário
- Tablet: 768px–1199px
  - KPIs com maior largura (span 4)
  - Kanban em 3 colunas por linha
- Mobile: < 768px
  - Header empilha
  - KPIs em coluna única
  - Formulários em coluna única
  - Kanban em 1 coluna por linha (sem perder funcionalidades)

4. Paleta de Cores (tokens)
- Fundo: --bg / --bg2 (escuro)
- Superfície: --surface / --surface2 / --card
- Texto: --text (alto contraste), --muted / --muted2 (secundário)
- Acentos: --brand (ciano) e --accent (violeta)
- Estado: --danger (erros), --success (sucesso)

5. Tipografia
- Fonte: Manrope
- Escala (aprox.)
  - Título de página: 28–30px
  - Título de secção: 14–15px
  - Texto: 14px
  - KPIs: 26px com peso alto

6. Componentes Padronizados
- Botão
  - .btn: padrão
  - .btn.primary: ação principal
  - .btn.danger: remoção/ações destrutivas
  - Estados: hover/active/focus-visible (com ring de foco)
- Input / Select / Textarea
  - Bordas e foco consistentes
  - Placeholder com menor opacidade
- Cards
  - .card: bloco principal
  - .kpi: cartão de indicador com destaque
- Listas
  - .item: linha de lista com meta secundária e ações à direita
- Mensagem de erro
  - .error: componente inline (role="alert") com visual de alerta

7. Secção “Etapas” (Kanban)
Etapas padrão:
- Novo → Contactado → Qualificado → Proposta → Fechado → Perdido

Funcionalidades:
- Adicionar cliente por nome completo (obrigatório)
- Validação do nome:
  - Não permite vazio
  - Não permite caracteres inválidos (aceita letras, espaços, hífen e apóstrofo)
- Editar cliente:
  - Botão “Editar” no card → modo de edição inline
- Remover cliente:
  - Botão “Remover” com confirmação
- Drag & drop:
  - Arraste cards entre colunas para alterar a etapa
  - Em mobile ou para acessibilidade: seletor “Mover” no próprio card
- Busca:
  - Campo “Buscar cliente…” filtra por nome
- Paginação/Performance:
  - “Carregar mais” por coluna (incrementos de 40)
  - Mantém a UI responsiva mesmo com > 500 clientes

8. Guia Rápido de Uso
- Dashboard
  - Selecione período → “Aplicar” para atualizar KPIs e transações recentes
- Vendas
  - Selecione o cliente (ou use “Cliente rápido” com nome obrigatório)
  - Selecione o sócio responsável pela venda: Fluxo Jusepp / Fluxo Bruno / Fluxo Kenan
- Investir
  - Registe investimentos por data/campanha/valor
- Histórico
  - As transações são agrupadas por dia (com data completa: dia/mês/ano)
  - Ao criar uma venda/investimento, o histórico passa a refletir automaticamente os novos registos
- Clientes → Etapas
  - Adicione nomes no topo
  - Arraste entre colunas ou use “Mover”
  - Use a busca para encontrar rapidamente

9. Checklist de Qualidade (Manual)
- Usabilidade
  - Criar cliente, criar venda, criar investimento, mover no Kanban sem dúvidas
  - Mensagens de erro claras quando faltam dados
- Acessibilidade
  - Tab navega por botões, inputs e ações
  - Foco sempre visível
  - Recomenda-se rodar auditoria Lighthouse (Chrome DevTools) para confirmar contraste e labels
- Responsividade
  - Verificar layout em 1200px, 1024px, 768px e 375px
