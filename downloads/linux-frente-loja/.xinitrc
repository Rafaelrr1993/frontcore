#!/bin/sh
# $XConsortium: xinitrc.cpp,v 1.4 91/08/22 11:41:34 rws Exp $

userresources=$HOME/.Xresources
usermodmap=$HOME/.Xmodmap
sysresources=/usr/X11R6/lib/X11/xinit/.Xresources
sysmodmap=/usr/X11R6/lib/X11/xinit/.Xmodmap

# merge in defaults and keymaps

if [ -f $sysresources ]; then
    xrdb -merge $sysresources
fi

if [ -f $sysmodmap ]; then
    xmodmap $sysmodmap
fi

if [ -f $userresources ]; then
    xrdb -merge $userresources
fi

if [ -f $usermodmap ]; then
    xmodmap $usermodmap
fi

# Start the window manager:
# PORTA=`xrandr | grep connected | grep -v dis | cut -d ' ' -f1`
# MONIT=`cvt 1024 768 60 | tail -n 1 | cut -d ' ' -f5-200`
# xrandr --newmode "1024x768_60.00" $MONIT
# xrandr --addmode $PORTA 1024x768_60.00
# xrandr --output $PORTA --mode 1024x768_60.00
# xrandr --output "VGA-1" --off
# xrandr --output "HDMI-1" --primary --pos 0x0
# xrandr --output "HDMI-1" --off
# xrandr --output "VGA-1" --primary --pos 0x0

# DUPLICAR TELAS SE COMENTAR A LINHA ABAIXO OS VIDEOS ESTENDEM
# xrandr --output HDMI-1 --same-as VGA-1

# DEFINIR TELA PRINCIPAL
# HDMI DEVE SER O MONITOR MAIOR DO OPERADOR (SIGLA: HDMI-1)
# VGA DISPLAY PORTA DEVE SER O MONITOR DO CLIENTE (SIGLA: VGA-1)
xrandr --output "HDMI-1" --primary --pos 0x0 --output "VGA-1" --pos 1024x0

# PEGAR NUMERO DA USB QUE CADA MONITOR ESTA LIGADO
DOIS=`xinput | grep ILITEK-TP | grep -v Mouse | cut -c 55-56`
# SETAR HDMI COMO PRINCIPAL
xinput map-to-output `echo $DOIS | cut -c 1-2` HDMI-1
# SETAR DISPLAY PORT COMO EXTENSAO
xinput map-to-output `echo $DOIS | cut -c 4-5` VGA-1

# CARREGAR VNC, SE PRECISAR ALTERE A SENHA NA LINHA ABAIXO
x11vnc -rfbport 5969 -nevershared -forever -passwd "pdvlinux" -display :0 &

# NAO APAGA TELA
xset s off
xset -dpms
xset s noblank

# EXECUTA GERENCIADOR DE JANELAS
qvwm
