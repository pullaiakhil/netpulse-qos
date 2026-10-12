# Makefile for NetPulse QoS C Measurement Engine
# Supports Linux (POSIX) and Windows (MinGW/MSYS2/Cygwin)

CC ?= gcc
CFLAGS ?= -O2 -Wall -Wextra
WIN_LIBS = -lws2_32 -liphlpapi
POSIX_LIBS = -lm

TARGET_WIN = netpulse_engine.exe
TARGET_POSIX = netpulse_engine
SRC = netpulse_engine.c
PREFIX ?= /usr/local

all:
ifeq ($(OS),Windows_NT)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET_WIN) $(WIN_LIBS)
else
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET_POSIX) $(POSIX_LIBS)
endif

# Explicit Linux compilation target (used in Dockerfile and Linux servers)
linux:
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET_POSIX) $(POSIX_LIBS)

# Explicit Windows compilation target
windows:
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET_WIN) $(WIN_LIBS)

# Install POSIX binary to system PATH (e.g. /usr/local/bin)
install: $(TARGET_POSIX)
	install -d $(DESTDIR)$(PREFIX)/bin
	install -m 755 $(TARGET_POSIX) $(DESTDIR)$(PREFIX)/bin/

clean:
ifeq ($(OS),Windows_NT)
	del $(TARGET_WIN) 2>nul || exit 0
else
	rm -f $(TARGET_POSIX) $(TARGET_WIN)
endif

.PHONY: all linux windows install clean
