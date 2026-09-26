# Shared sources for the ring and receiver apps.
set(FW_COMMON_DIR ${CMAKE_CURRENT_LIST_DIR})

target_include_directories(app PRIVATE ${FW_COMMON_DIR})
target_sources(app PRIVATE
  ${FW_COMMON_DIR}/pointer_engine.c
  ${FW_COMMON_DIR}/link_packet.c
  ${FW_COMMON_DIR}/cfg_store.c
  ${FW_COMMON_DIR}/proto.c
  ${FW_COMMON_DIR}/radio.c
  ${FW_COMMON_DIR}/usb_io.c
)

# Our code is held to stricter warnings than the SDK defaults.
target_compile_options(app PRIVATE -Wextra -Wshadow -Wno-unused-parameter
  -Wno-missing-field-initializers -Wno-type-limits -Werror)
