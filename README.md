# ZapTranscriber

Extensão para Google Chrome que adiciona um botão **Transcrever** às mensagens de voz do WhatsApp Web. Para quem está cansado de ouvir áudios longos que poderiam ser escritos em duas palavras.

## Recursos

- Botão de transcrição integrado às mensagens de voz.
- Resultado exibido junto do áudio, sem sair da conversa.
- Cópia da transcrição com um clique.
- Transcrição 100% local com Whisper Tiny — grátis e sem login.
- Conversão local do áudio do WhatsApp para WAV mono de 16 kHz.
- Divisão automática de áudios longos em trechos de até cinco minutos.
- Idioma principal configurável.
- Modelo e runtime de IA incluídos no pacote; nenhuma chave de API é necessária.

## Instalação

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` no Google Chrome.
3. Ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta raiz do projeto, a mesma que contém `manifest.json`.
6. Fixe o ZapTranscriber na barra do Chrome.
7. Abra ou recarregue [WhatsApp Web](https://web.whatsapp.com/).

## Como usar

Em uma conversa do WhatsApp Web, localize uma mensagem de voz e clique em **Transcrever**. O texto aparecerá logo abaixo do áudio e poderá ser copiado.

Se um áudio ainda não estiver disponível para a extensão, reproduza um instante da mensagem para o WhatsApp carregá-lo e tente novamente.

## Gratuito e sem conta

O ZapTranscriber não usa API paga, chave, cadastro ou servidor. O pacote inclui o modelo multilíngue Whisper Tiny em formato ONNX quantizado e executa a IA no próprio Chrome. A primeira transcrição pode demorar um pouco enquanto o navegador carrega cerca de 60 MB de runtime e modelo na memória.

## Privacidade

- Nenhum áudio é enviado automaticamente.
- Ao clicar em **Transcrever**, aquela mensagem é processada no próprio dispositivo.
- O áudio e a transcrição não são enviados a serviços externos.
- O projeto não possui servidor, conta, chave de API, cobrança nem telemetria.

Não use a extensão para processar áudio sem autorização das pessoas envolvidas. Avalie as regras de privacidade e proteção de dados aplicáveis ao seu uso.

## Desenvolvimento

Requisitos para recompilar: Node.js 20 ou mais recente. O código distribuído já inclui os arquivos gerados.

```bash
npm test
npm run validate
npm run check
```

No Windows, gere um ZIP instalável com:

```powershell
.\scripts\package-extension.ps1
```

O arquivo será criado em `dist/`.

## Estrutura

```text
background/   runtime de transcrição local compilado
content/      integração visual com o WhatsApp Web
icons/        ícones da extensão
lib/          conversão e divisão do áudio
models/       Whisper Tiny ONNX quantizado
offscreen/    execução isolada do modelo local
popup/        tela local de configurações
scripts/      validação, ícones e empacotamento
src/          código-fonte do serviço e da inferência
tests/        testes unitários sem dependências externas
vendor/       WebAssembly do ONNX Runtime
```

## Aviso

Este projeto não é afiliado, patrocinado ou endossado pelo WhatsApp, Meta, OpenAI ou Hugging Face. Mudanças na interface do WhatsApp Web podem exigir ajustes no content script.

## Licença

O código do ZapTranscriber usa a licença [MIT](LICENSE). As licenças e atribuições dos componentes embarcados estão em [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
