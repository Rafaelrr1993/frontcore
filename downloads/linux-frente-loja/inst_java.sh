#!/bin/bash
#################################################
#---> Avanco Informatica Ltda		    <---#
#---> Script para instalacao JAVA no LINUX  <---#
#---> Nome..: inst_java.sh                  <---#
#---> Autor.: Wagner Silva                  <---#
#---> Data..: 28/12/2012                    <---#
#################################################

##### <CTRL C> + LIMPA TELA
stty -isig
clear

## TESTE DE SERVIDOR

if [ -x /u/sist ]; then
   clear
   tput smso
   tput cup 12 05; echo  "A ATUALIZACAO ESTA SENDO ABORTADA, POIS ESTA MAQUINA E UM SERVIDOR!"
   tput cup 13 05; echo ""    
   tput rmso
   sleep 2
   exit
   
   else
   
apresenta() {
	    clear
    	    tput smso
    	    tput cup  9 27; echo "                           "
    	    tput cup 10 27; echo "   INSTALAR JAVA LINUX     "
    	    tput cup 11 27; echo "    EM SLACKWARE 14.0      "
    	    tput cup 12 27; echo "  <S> INSTALAR <N> SAIR    "
    	    tput cup 13 27; echo "                           "
    	    tput cup 15 27; echo "                           "
            while  
                tput smso
		tput cup 14 27; echo "                           "
		tput cup 14 29; echo -n "  ESCOLHA A OPCAO.: "
                tput rmso 
            do
		read opcao
		case $opcao in  
	             S|s|N|n)	break ;;
		esac
	    done
	    if [ $opcao = "N" ] || [ $opcao = "n" ] 
		then
	         clear
	         tput smso
		 tput cup 12 03; echo -n " ROTINA DE INSTALACAO DO JAVA LINUX PARA SLACKWARE 14.0 NAO EXECUTADA !!! "
	         tput rmso
		 tput cup 23 1; echo ' '
	         exit
	    fi
}	

#### FUNCAO TELA FINALIZA
finaliza() {
	    clear
    	    tput smso
    	    tput cup  9 15; echo    "                                                  "
    	    tput cup 10 15; echo    "  PROCESSO DE INSTALACAO JAVA LINUX REALIZADO     "
            tput cup 11 15; echo    "                                                  "
            tput cup 12 15; echo -n "  COM SUCESSO, PRESSIONE [ENTER] PARA SAIR E      "
            tput cup 13 15; echo    "                                                  " 
    	    tput cup 14 15; echo    "  REINICIE A MAQUINA P/ CONCLUIR A INSTALACAO.    "
            tput rmso
            tput cup 15 15; echo ' '
	    read nada    
}


apresenta

clear
tput smso
tput cup 11 25
echo " AGUARDE INSTALANDO JAVA LINUX ... "
tput rmso

cd /u/ >> /dev/null
installpkg jdk-6u11-i586-1.tgz >> /dev/null
finaliza
fi
