# ZapTranscriber

Extensão para Google Chrome que adiciona um botão **Transcrever** às mensagens de voz do WhatsApp Web. Para quem está cansado de ouvir áudios longos que poderiam ser escritos em duas palavras.

## Recursos

- Botão de transcrição integrado às mensagens de voz.
- Resultado exibido junto do áudio, sem sair da conversa.
- Cópia da transcrição com um clique.
- Transcrição 100% local com Whisper Small — grátis e sem login.
- Decodificação e conversão local do áudio do WhatsApp para WAV mono de 16 kHz.
- Divisão automática de áudios longos em trechos de até cinco minutos.
- Idioma principal configurável.
- Modelo e runtime de IA incluídos no pacote; nenhuma chave de API é necessária.
- Funciona com mensagens de voz antigas e novas que estejam visíveis na conversa.

## Instalação

1. Abra a página de [Releases](https://github.com/matheusgdqueiroz-del/ZapTranscriber/releases) e baixe o arquivo `ZapTranscriber-vX.Y.Z.zip` da versão mais recente.
2. Não use os arquivos automáticos **Source code (zip)** ou **Source code (tar.gz)**: eles podem conter apenas ponteiros do Git LFS no lugar do modelo de IA.
3. Extraia completamente o ZIP baixado.
4. Abra `chrome://extensions` no Google Chrome.
5. Ative o **Modo do desenvolvedor** no canto superior direito.
6. Clique em **Carregar sem compactação**.
7. Selecione a pasta extraída, a mesma que contém `manifest.json`.
8. Fixe o ZapTranscriber na barra do Chrome.
9. Abra ou recarregue [WhatsApp Web](https://web.whatsapp.com/).

Para clonar o código-fonte em vez de usar o pacote da Release, instale o Git LFS antes do `git clone` e confirme que os dois arquivos `.onnx` foram baixados por completo.

## Como usar

Em uma conversa do WhatsApp Web, localize uma mensagem de voz e clique em **Transcrever**. O texto aparecerá logo abaixo do áudio e poderá ser copiado.

Mensagens antigas também podem ser transcritas: role a conversa até o áudio para que ele fique visível e clique em **Transcrever**. Não é necessário reproduzi-lo antes.

## Gratuito e sem conta

O ZapTranscriber não usa API paga, chave, cadastro ou servidor. O pacote inclui o modelo multilíngue Whisper Small em formato ONNX quantizado e executa a IA no próprio Chrome. Ele é consideravelmente mais preciso que os modelos Tiny e Base usados anteriormente, em troca de um pacote maior e alguns segundos adicionais de processamento. A primeira transcrição também pode demorar mais enquanto o navegador carrega o modelo na memória.

Para acessar o arquivo de uma mensagem no player atual, a extensão inclui o WA-JS e o executa localmente dentro da sessão do WhatsApp Web já aberta. Isso não conecta nenhuma conta adicional e não envia o áudio para o WPPConnect.

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
models/       Whisper Small ONNX quantizado
offscreen/    execução isolada do modelo local
page/         ponte local para o player atual do WhatsApp Web
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
