// -----------------------------------------------------------------------
// manuals-data.js — conteúdo dos manuais indexados pelo balão de ajuda
// (help-widget.js). Cada manual tem um título e uma lista de seções
// {titulo, texto} — a busca roda sobre elas (ver help-search.js).
//
// Pra adicionar um manual novo: extraia o texto (PDF, DOCX, .txt...),
// quebre em seções por assunto e acrescente um objeto aqui. Nada disso
// é enviado a servidor nenhum — o índice inteiro vai junto com a página.
// -----------------------------------------------------------------------

export const MANUALS = [
  {
    id: "balanca-toledo-8217-usb",
    titulo: "Configuração Balança Toledo 8217 USB",
    fonte: "Manual interno (Confluence)",
    secoes: [
      {
        titulo: "Visão geral e protocolos errados mais comuns",
        texto:
          "Este modelo de balança (Toledo 8217 USB) funciona com o Sistema Frente de Loja. " +
          "De acordo com testes realizados, existem possibilidades da balança estar configurada " +
          "de forma errada. Protocolos de configuração errados observados: C 0 9 com P05B — o certo " +
          "é passar para P05. C 10 com 1200B — o certo é passar para 2400.",
      },
      {
        titulo: "Configuração no Supervisor — PDV Windows",
        texto:
          "A configuração no Supervisor para funcionamento do PDV Windows deve ser: Porta de " +
          "comunicação (disponível na máquina), Balança: Toledo II, Configuração: 2400,N,8,1.",
      },
      {
        titulo: "PDV Linux — detectar a porta USB da balança",
        texto:
          "Conecte o cabo USB com a balança ligada na CPU e execute o comando: lsusb. Se aparecer " +
          "'Bus 002 Device 003: ID 10c4:ea60 Cygnal Integrated Products, Inc. CP210x Composite " +
          "Device', a balança foi detectada pelo sistema operacional Linux. Em seguida, execute " +
          "'ls /dev/ttyUSB?' pra identificar em qual TTY o dispositivo está — vai aparecer algo como " +
          "/dev/ttyUSB0, /dev/ttyUSB1 ou /dev/ttyUSB2 (varia conforme a quantidade de USBs " +
          "conectados na CPU).",
      },
      {
        titulo: "PDV Linux — editar o rc.local pra apontar a porta da balança",
        texto:
          "Depois de identificar o USB (ex.: /dev/ttyUSB0), acesse 'cd /etc/rc.d' e edite o arquivo " +
          "com 'mcedit rc.local'. Configuração original: liga ttyS0→cua0, ttyS1→cua1, ttyS2→cua2, " +
          "ttyS3→cua3. Pra balança funcionar na porta 4, troque para: manter ttyS0→cua0, ttyS1→cua1, " +
          "ttyS2→cua2, remover ttyS3 ('rm ttyS3'), ligar ttyUSB0 a ttyS3 " +
          "('/usr/bin/ln -s ttyUSB0 ttyS3') e comentar a linha antiga de cua3. Salve o rc.local e " +
          "reinicie a máquina. Depois de reiniciar, confira com 'ls -la /dev/ttyS*' — deve aparecer " +
          "'/dev/ttyS3 -> /dev/ttyUSB0'. Nesse exemplo, a porta da balança no Supervisor será COM4.",
      },
      {
        titulo: "Configuração no Supervisor — PDV Linux",
        texto:
          "A configuração no Supervisor para funcionamento do PDV Linux deve ser: Porta de " +
          "comunicação COM4 (ou a porta COM correspondente à ttyS que você configurou), Balança: " +
          "Toledo II, Configuração: 2400,N,8,1.",
      },
    ],
  },
];
