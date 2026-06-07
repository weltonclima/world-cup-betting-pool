# PRD 01.1 - Recuperação de Senha

## Objetivo
Permitir recuperação de senha utilizando Firebase Authentication.

## Fluxo
Login -> Esqueci Minha Senha -> Enviar E-mail -> Redefinir Senha -> Login

## Tela 01 - Esqueci Minha Senha
Campos:
- E-mail

Ações:
- Enviar Link
- Voltar para Login

## Tela 02 - E-mail Enviado
Mensagem:
Verifique sua caixa de entrada.

## Tela 03 - Redefinir Senha
Campos:
- Nova Senha
- Confirmar Senha

## Tela 04 - Sucesso
Mensagem:
Senha alterada com sucesso.

## Firebase
- sendPasswordResetEmail
- confirmPasswordReset

## Critérios de Aceite
- Envio de e-mail
- Redefinição de senha
- Login com nova senha
