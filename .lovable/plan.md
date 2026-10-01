# Cadastro com tipo de usuário e permissões

## Objetivo
Adicionar ao cadastro de nova conta a escolha entre **Agente** e **Coordenação**, mantendo os papéis separados dos dados do perfil.

## Alterações
- Incluir o campo “Tipo de usuário” no formulário de criação de conta.
- Registrar a nova conta e seu papel em uma operação protegida no servidor, aceitando somente `agent` ou `coordinator`.
- Manter **Agente** como padrão e limitar agentes aos próprios registros.
- Fazer **Coordenação** visualizar todos os registros, porém sem botões ou ações de criar, editar e excluir.
- Atualizar as regras do banco para impedir que Coordenação altere registros mesmo por requisições diretas.
- Preservar as permissões existentes de Administrador e Visualizador.

## Validação
- Conferir cadastro visual em telas grande e pequena.
- Confirmar que Agente continua vendo e gerenciando apenas os próprios dados.
- Confirmar que Coordenação vê dados consolidados sem qualquer ação de escrita.
- Verificar compilação e erros de execução.

## Detalhes técnicos
- O papel continuará na tabela separada de funções de usuário, nunca no perfil.
- O cadastro será validado no servidor e a atribuição do papel usará acesso privilegiado somente após a conta ser criada com sucesso.
- As políticas de atualização de atividades, organizações e atores deixarão de autorizar `coordinator`; as políticas de leitura ampla serão mantidas.
