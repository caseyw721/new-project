# Host unit tests for the shared firmware logic.
#   make -C controller/firmware/tests
CC ?= cc
CFLAGS += -std=c11 -O2 -g -Wall -Wextra -Werror -Wshadow \
	  -fsanitize=address,undefined -fno-omit-frame-pointer -I../common
# The firmware runs on a single-precision FPU: catch any accidental double math.
FW_CFLAGS = -Wdouble-promotion -Wfloat-conversion
LDLIBS += -lm

run: test_runner
	./test_runner

pointer_engine.o: ../common/pointer_engine.c ../common/pointer_engine.h
	$(CC) $(CFLAGS) $(FW_CFLAGS) -c -o $@ $<

link_packet.o: ../common/link_packet.c ../common/link_packet.h
	$(CC) $(CFLAGS) $(FW_CFLAGS) -c -o $@ $<

test_runner: test_main.c pointer_engine.o link_packet.o
	$(CC) $(CFLAGS) -o $@ $^ $(LDLIBS)

clean:
	rm -f test_runner *.o

.PHONY: run clean
