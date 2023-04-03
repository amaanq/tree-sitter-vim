; Keywords

[
  "echo"
  "echomsg"
  "echon"
  "echoerr"
  "echohl"
  "mark"
  "let"
  "unlet"
  "command"
] @keyword
(map_statement command: _ @keyword)

[
  "<buffer>"
  "<nowait>"
  "<silent>"
  "<script>"
  "<expr>"
  "<unique>"
] @constant.builtin

[
  "call"
  "function"
  "endfunction"
] @keyword.function
