cmake_minimum_required(VERSION 3.20.0)

set(EXTRA_CONF_FILE ${CMAKE_CURRENT_LIST_DIR}/../common/common.conf)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(receiver)

target_sources(app PRIVATE src/main.c)
target_include_directories(app PRIVATE src)
include(${CMAKE_CURRENT_LIST_DIR}/../common/common.cmake)
