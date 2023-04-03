/**
 * @file Vimscript grammar for tree-sitter
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  LAMBDA: -2,
  PARENTHESES: -1,
  TERNARY: 1,
  LOGICAL_OR: 2,
  LOGICAL_AND: 3,
  EQUALITY: 4,
  COMPARE: 5,
  ADD: 6,
  CONCAT: 6,
  MULTIPLY: 7,
  UNARY: 8,
  CALL: 9,
  MEMBER: 10,
};

module.exports = grammar({
  name: 'vim',

  conflicts: $ => [
    [$.map_definition],
  ],

  externals: $ => [
    $._line_continuation,
    $._separator,
    $.keycode_content,
    $.keycode_separator,
    // $.keycode,
    $.end_keycode,
    // $.heredoc_language,
    $.heredoc_start,
    $.heredoc_content,
    $.oneliner_heredoc_content,
    $.heredoc_end,
  ],

  extras: $ => [
    $._line_continuation,
    $.comment,
    /\s/,
  ],

  inline: $ => [
    $.keyword_identifier,
    $.set_option,
    // $._no_nl_statement,
    // $._nl_statement,
  ],

  supertypes: $ => [
    $.statement,
    $.embedded_statement,
    $.expression,
  ],

  word: $ => $.identifier,

  rules: {
    script: $ => repeat($.statement),

    statement: $ => choice(
      $._no_nl_statement,
      $._nl_statement,
      $.set_statement,
    ),

    // Statements that don't necesitate a separator, and will add them in blocks
    _no_nl_statement: $ => choice(
      // $.function_definition,
      // $.command,
      // $.echo_statement,
      $.echohl_statement,
      $.call_statement,
      // $.unlet_statement,
      $.if_statement,
      $.for_statement,
      $.while_statement,
      $.break,
      $.return_statement,
      $.try_statement,
      $.throw_statement,
      $.command_statement,
      $.repeated_command,
      $.sign_statement,
      $.mark_statement,
      $.normal_statement,
      $.finish,
      // $.eval_statement,
      $.builtin_command_statement,
      $.command,
      $.substitution_command,
      // $.unknown_builtin_statement,
    ),

    // Statements that embed the separator in them
    _nl_statement: $ => choice(
      $.function_definition,
      $.let_statement,
      $.echo_statement,
      $.execute_statement,
      $.unlet_statement,
      // $.return_statement,
      $.map_statement,
      $.unknown_builtin_command,
      $.silent_statement,
      $.autocmd_statement,
      $.augroup_statement,
      $.heredoc_statement,
      $.expression_statement,
      $.regex_pattern_statement,
      $.filter_command,
    ),

    // Statements for the repetition in keymaps and autocmds
    embedded_statement: $ => choice(
      // $.command,
      alias($._autocmd_statement, $.autocmd_statement),
      alias($._unknown_builtin_command, $.unknown_builtin_command),
      // $.builtin_command_statement,
      // $.call_statement,
      alias($._execute_statement, $.execute_statement),
      $.eval_statement,
    ),

    _block: $ => repeat1(choice(
      seq(optional($._no_nl_statement), $._separator),
      $._nl_statement,
      $.set_statement,
    )),

    function_definition: $ => seq(
      /fun(c(tion)?)?|def(ine)?/,
      token.immediate(optional('!')),
      choice($._identifier, $.field_identifier),
      '(', optional($.arguments), ')',
      repeat(choice('dict', 'range', 'abort', 'closure')),
      optional($._block),
      /endf(u(n(c(tion)?)?)?)?|enddef/,
      token.immediate(optional('!')),
      optional($._identifier),
      $._separator,
    ),

    arguments: $ => prec(1, seq(
      choice(
        seq(commaSep1($.identifier), optional(seq(',', '...'))),
        '...',
      ),
    )),

    // Call statements alone will necesitate a newline? (from what I can tell), but not in commands
    command: $ => seq(
      ':',
      optional($.range_statement),
      repeat(choice($.keycode, $.end_keycode)),
      choice(
        $._bare_key,
        $.identifier,
        $.call_statement,
        $._execute_statement,
        $._set_statement,
        $.eval_statement,
        $.normal_statement,
        $.substitution_command,
        $.heredoc_statement,
        alias($._unknown_builtin_command, $.unknown_builtin_command),
        '!',
      ),
    ),

    builtin_command: $ => choice(
      // fuck %
      /%[\[\]',a-zA-Z0-9_]*/,
      token(prec(-1, seq(/[a-zA-Z]?[$|^|%']/, /[\[\]',a-zA-Z0-9_]*/))),
      // phpcomplete.vim L2097 silent! 0put =cfile
      // seq(/\d+\w/, '=', $.expression),
      token(seq(/\d+\w+/, /[^.]*/, /./)),
    ),

    builtin_command_statement: $ => seq($.builtin_command, $.statement),

    filter_command: $ => seq(
      '%',
      '!',
      optional('!'),
      // $.identifier,
      $.filename,
      optional('!'),
      repeat(choice(
        seq(
          choice(/\S/, seq('\\', /./)),
          repeat(choice(...[/\S/, seq('\\', /./)].map(token.immediate))),
        ),
        $.string,
      )),
      $._separator,
    ),

    // TODO(anyone reading this): toss this in the external scanner to have stateful tracking
    // of what the delimiter is, currently it just assumes it'll be /
    substitution_command: _ => token(seq(
      optional('%'),
      's',
      '/',
      repeat(choice(/[^/]+/, '\\/', '\\\\')),
      '/',
      repeat(choice(/[^/]+/, '\\/', '\\\\')),
      '/',
      optional(choice('g', 'c', 'e', 'p', 'r', 'i', 'I', 'C', 'E', 'P', 'R')),
    )),

    repeated_command: $ => seq($.number, token.immediate(/[a-zA-Z0-9_]+/)),

    echo_statement: $ => seq(
      choice('echo', 'echom', 'echomsg', 'echon', 'echoerr'),
      repeat1($.expression),
      $._separator,
    ),

    echohl_statement: $ => seq('echohl', $.hl_group),

    call_statement: $ => prec(1, seq('call', $.call_expression)),

    eval_statement: $ => seq('=', $.expression),

    execute_statement: $ => seq(/exe(c(ute)?)?/, repeat1($.expression), $._separator),
    _execute_statement: $ => prec.right(alias(seq(/exe(c(ute)?)?/, repeat1($.expression)), $.execute_statement)),

    range_statement: $ => seq(
      field('start', $._range_marker),
      optional(seq(choice(',', ';'), field('end', $._range_marker))),
    ),

    _range_marker: $ => choice(
      $.number,
      '.',
      '+',
      '$',
      '%',
      /'./,
      '\\/',
      '\\?',
      '\\&',
    ),

    mark_statement: $ => seq(
      optional('.'),
      'mark',
      $._bare_key,
    ),

    let_statement: $ => seq(
      'let',
      $.expression,
      choice('=', '+=', '-=', '*=', '/=', '%=', '.=', '..='),
      $.expression,
      $._separator,
    ),

    unlet_statement: $ => seq(
      $._unlet_statement,
      $._separator,
    ),
    _unlet_statement: $ => prec.right(seq(
      'unlet',
      token.immediate(optional('!')),
      repeat1(choice($.expression, alias(/"[^\r\n]+/, $.comment))),
    )),

    if_statement: $ => seq(
      'if',
      $.expression,
      // $._separator,
      $._block,
      repeat($.elseif_statement),
      optional($.else_statement),
      /end(if)?/,
    ),

    elseif_statement: $ => seq(
      'elseif',
      $.expression,
      // $._separator,
      $._block,
    ),

    else_statement: $ => seq(
      'else',
      // $._separator,
      $._block,
    ),

    for_statement: $ => seq(
      'for',
      field('left', choice($._identifier, $.list_assignment)),
      'in',
      field('right', $.expression),
      // $._separator,
      $._block,
      'endfor',
    ),

    while_statement: $ => seq(
      'while',
      $.expression,
      // $._separator,
      $._block,
      /endw(hile)?/,
    ),

    break: _ => 'break',

    return_statement: $ => prec.right(seq('return', optional($.expression))),

    try_statement: $ => seq(
      'try',
      $._separator,
      choice($._block, $._no_nl_statement),
      repeat($.catch_statement),
      optional($.finally_statement),
      'endtry',
    ),

    catch_statement: $ => seq(
      'catch',
      optional(alias(choice(/\/.*\//, /\?.*\?/), $.pattern)),
      $._block,
    ),

    finally_statement: $ => seq(
      'finally',
      $._block,
    ),

    throw_statement: $ => seq(
      'throw',
      $.expression,
    ),

    command_statement: $ => seq(
      'command',
      token.immediate(optional('!')),
      optional(choice(
        $.command_name,
        seq(
          repeat($.command_attribute),
          $.command_name,
          alias(/.*/, $.command),
        ),
      )),
    ),
    command_name: _ => /[A-Z][A-Za-z0-9]*/,
    command_attribute: $ =>
      choice(
        seq(
          '-addr',
          '=',
          choice('lines', 'arguments', 'buffers', 'loaded_buffers', 'windows', 'tabs', 'quickfix', 'other'),
        ),
        '-bang',
        '-bar',
        '-buffer',
        seq(
          '-complete',
          '=',
          choice(
            'arglist',
            'augroup',
            'buffer',
            'behave',
            'color',
            'command',
            'compiler',
            'cscope',
            'dir',
            'environment',
            'even',
            'expression',
            'file',
            'file_in_path',
            'filetype',
            'function',
            'help',
            'highlight',
            'history',
            'local',
            'lua',
            'mapclear',
            'mapping',
            'menu',
            'messages',
            'option',
            'packadd',
            'shellcmd',
            'sign',
            'syntax',
            'syntime',
            'tag',
            'tag_listfiles',
            'user',
            'var',
            seq(choice('custom', 'customlist'), ',', $._identifier),
          ),
        ),
        '-count',
        seq('-count', '=', alias(token.immediate(/[0-9]+/), $.number)),
        '-keepscript',
        seq(
          '-nargs',
          '=',
          choice(
            alias(token.immediate(/[01]/), $.number),
            alias(token.immediate(/[*?+]/), $.pattern),
          ),
        ),
        '-range',
        seq(
          '-range',
          '=',
          choice(
            alias(token.immediate(/[01]/), $.number),
            alias(token.immediate(/[*?+%]/), $.pattern),
          ),
        ),
        '-register',
      ),

    map_statement: $ => seq(
      choice(
        'map',
        'nmap',
        'vmap',
        'xmap',
        'smap',
        'omap',
        'imap',
        'lmap',
        'cmap',
        'tmap',
        'unmap',
        'nunmap',
        'vunmap',
        'xunmap',
        'sunmap',
        'ounmap',
        'iunmap',
        'lunmap',
        'cunmap',
        'tunmap',
        'noremap',
        'vnoremap',
        'nnoremap',
        'xnoremap',
        'snoremap',
        'onoremap',
        'inoremap',
        'lnoremap',
        'cnoremap',
        'tnoremap',
      ),
      token.immediate(optional('!')),
      repeat(choice('<buffer>', '<nowait>', '<silent>', '<unique>', '<script>')),
      $.map_definition,
      $._separator,
    ),
    map_definition: $ => prec.right(1, choice(
      seq(
        '<expr>',
        repeat(choice('<buffer>', '<nowait>', '<silent>', '<unique>', '<script>')),
        field('left', choice(seq($.key, token.immediate(/[a-zA-Z0-9]*/)), $.unique_identifier, $.plug_command)),
        field('right', $.expression),
      ),
      seq(
        field('left', choice(seq($.key, token.immediate(/[a-zA-Z0-9]*/)), $.unique_identifier, $.plug_command, $._bare_key)),
        field('right', choice(
          seq(repeat($.key), optional(choice($.identifier, $.plug_command, $._bare_key))),
          // FIXME: Improve this shitty mess
          // repeat1(seq(
          //   repeat($.key),
          //   sep1($.statement, alias(/<[bB][aA][rR]>/, $.key)),
          //   $.end_keycode,
          //   optional($._bare_key),
          //   optional($.macro),
          // )),
          // seq(
          //   repeat($.key),
          //   sep($.statement, alias(/<[bB][aA][rR]>/, $.key)),
          //   $.end_keycode,
          //   repeat1($.key),
          //   optional($.macro),
          // ),
          repeat1(choice(
            $.key,
            sep1(
              // choice($.statement, $._execute_statement, $.eval_statement, $._set_statement),
              choice($._no_nl_statement, $.embedded_statement),
              alias(/<[bB][aA][rR]>/, $.key),
            ),
            $.macro,
            $.end_keycode,
            $._bare_key,
            $._identifier,
            alias($._call_expression, $.call_expression),
          )),
        )),
      ),
    )),

    _call_expression: $ => prec(PREC.CALL, seq(
      field('callee', $._identifier),
      '(',
      commaSep($.expression),
      ')',
    )),

    key: $ => seq(choice(
      $.keycode,
      '>',
      '<',
      '>>',
      '<<',
      '%',
      /[a-zA-Z0-9\[\]\{\}#-]\$?/,
      // (* <blah> <blah> <blah> *)
      seq('(', repeat1(choice($.keycode, $._bare_key)), ')'),
    )),

    keycode: $ => seq('<', sep1($.keycode_content, $.keycode_separator), '>'),

    plug_command: $ => seq(
      '<Plug>',
      choice($.identifier, $.keycode, seq('(', $.identifier, ')')), // (Matchit*)
    ),

    // FIXME: just register macros here..
    macro: _ => token(/[a-zA-Z0-9]@/),

    sign_statement: $ => seq(
      'sign',
      choice(
        $.sign_define,
        // $.sign_undefine,
        // $.sign_list,
        // $.sign_place,
        // $.sign_unplace,
        // $.sign_jump,
      ),
    ),

    sign_define: $ => seq(
      'define',
      field('name', choice($.identifier, $.number)),
      repeat(choice(
        // seq('icon', '=', optional($.filename)),
        seq('linehl', '=', optional($.hl_group)),
        seq('numhl', '=', optional($.hl_group)),
        seq('text', '=', optional(/[^\t\n\v\f\r]/)),
        seq('texthl', '=', optional($.hl_group)),
        seq('culhl', '=', optional($.hl_group)),
      )),
    ),

    expression_statement: $ => seq(
      choice(
        $.env_variable,
        $.register,
        $.option,
        $.number,
        $.relative_number,
        $.builtin_command,
        '!',
      ),
      optional('_'), // discard register
      $._separator,
    ),

    expression: $ => choice(
      $.unary_expression,
      $.binary_expression,
      $.ternary_expression,
      $.call_expression,
      $.member_expression,
      $.range_expression,
      // $.indirect_reference_expression,
      $.field_expression,
      $.parenthesized_expression,
      $.lambda_expression,
      $.dictionary,
      $.literal_dictionary,
      $._identifier,
      // $.indirect_reference_identifier,
      $.list,
      $.env_variable,
      $.register,
      $.option,
      $.number,
      $.string,
      // $.regex_pattern,
      // $.key,
      $.builtin_command,
      $.end_keycode,
      '!',
    ),

    unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '+', '-')),
      field('argument', $.expression),
    )),

    binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['==', PREC.EQUALITY],
        ['!=', PREC.EQUALITY],
        ['=~', PREC.EQUALITY],
        ['!~', PREC.EQUALITY],
        ['>', PREC.COMPARE],
        ['>=', PREC.COMPARE],
        ['<=', PREC.COMPARE],
        ['<', PREC.COMPARE],
        ['is', PREC.COMPARE],
        ['isnot', PREC.COMPARE],
        ['.', PREC.CONCAT],
        ['..', PREC.CONCAT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        if (precedence == PREC.EQUALITY || precedence == PREC.COMPARE) {
          // @ts-ignore
          operator = seq(operator, token.immediate(optional(choice('?', '#'))));
        }

        return prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        ));
      }));
    },

    ternary_expression: $ => prec.left(PREC.TERNARY, seq(
      $.expression,
      '?',
      $.expression,
      ':',
      $.expression,
    )),

    call_expression: $ => prec(PREC.CALL, seq(
      field('callee', $.expression),
      '(',
      commaSep($.expression),
      ')',
    )),

    // field_expression: $ => prec(PREC.MEMBER, seq(
    //   $.expression,
    //   '.',
    //   field('field', choice($.identifier, $.number)),
    // )),

    member_expression: $ => prec(PREC.MEMBER, seq(
      $.expression,
      '[',
      $.expression,
      ']',
    )),

    range_expression: $ => prec(PREC.MEMBER, seq(
      $.expression,
      '[',
      optional(field('begin', $.expression)),
      ':',
      optional(field('end', $.expression)),
      ']',
    )),

    indirect_reference_expression: $ => prec(PREC.MEMBER, seq(
      $._identifier,
      '{',
      $.expression,
      '}',
    )),

    field_expression: $ => prec.right(PREC.MEMBER, seq(
      $.expression,
      choice('->', token.immediate('.')),
      $.expression,
    )),

    parenthesized_expression: $ => prec(PREC.PARENTHESES, seq(
      '(',
      $.expression,
      ')',
    )),

    lambda_expression: $ => prec(PREC.LAMBDA, seq(
      '{',
      optional($.arguments),
      '->',
      $.expression,
      '}',
    )),

    set_statement: $ => prec(-1, seq(
      $._set_statement,
      $._separator,
    )),

    _set_statement: $ => seq(
      /set(l(ocal)?)?/,
      repeat1($.set_item),
    ),

    set_item: $ => prec.right(seq(
      field('option', $.set_option),
      optional(seq(
        field('operator', token.immediate(choice('=', ':', '+=', '^=', '-=', '<'))),
        field('right', commaSep(choice(
          $._identifier,
          $.number,
          $.filename,
          // token(prec(1, /%[^\r\n]+/)), // % command
          token(/[^\r\n]+/), // catch-all
        ))),
      )),
    )),

    set_option: $ => choice(
      'all',
      'all&',
      $.option_identifier,
      seq($.option_identifier, '?'),
      // $.no_option,
      // $.inv_option,
      $.default_option,
    ),

    normal_statement: $ => seq(
      /norm(al)?/,
      token.immediate(optional('!')),
      $._bare_key,
    ),

    silent_statement: $ => seq(
      choice('silent', 'sil'),
      token.immediate(optional('!')),
      // $.statement,
      choice(
        seq($._no_nl_statement, $._separator),
        $._nl_statement,
      ),
      // $._separator,
    ),

    autocmd_statement: $ => seq(
      $._autocmd_statement,
      $._separator,
    ),
    _autocmd_statement: $ => prec.right(seq(
      choice('autocmd', 'au'),
      token.immediate(optional('!')),
      optional($.identifier),
      commaSep($.event),
      optional($.filename),
      repeat(choice('<buffer>', '<nowait>', '<silent>', '<unique>', '<script>')),
      optional(
        seq(
          // commaSep1($.identifier),
          // commaSep1(alias(/[^ \t\n,]+/, $.pattern)),
          optional('++once'),
          optional('++nested'),
          field('command', repeat1(choice($._no_nl_statement, $.embedded_statement))),
        ),
      ),
    )),

    event: _ => token(choice(
      /Buf([A-Z][a-z]+)+/,
      /Chan([A-Z][a-z]+)+/,
      /Cmd([A-Z][a-z]+)+/,
      /ColorScheme([A-Z][a-z]+)?/,
      /Complete([A-Z][a-z]+)+/,
      /Cursor([A-Z][a-z]+)+/,
      'DiffUpdated',
      /DirChanged([A-Z][a-z]+)?/,
      'ExitPre',
      /File([A-Z][a-z]+)+/,
      /Filter([A-Z][a-z]+)+/,
      /Focus([A-Z][a-z]+)+/,
      'UIEnter',
      /Insert([A-Z][a-z]+)+/,
      'MenuPopup',
      'ModeChanged',
      'OptionSet',
      /QuickFixCmd(Pre|Post)/,
      'QuitPre',
      'RemoteReply',
      'SearchWrapped',
      /Recording(Enter|Leave)/,
      'SessionLoadPost',
      /Shell(Cmd|Filter)Post/,
      'Signal',
      /Source(Pre|Post|Cmd)/,
      'SpellFileMissing',
      /StdinRead(Pre|Post)/,
      'SwapExists',
      'Syntax',
      /Tab([A-Z][a-z]+)+/,
      /Term([A-Z][a-z]+)+/,
      /Text([A-Z][a-z]+)?/,
      'User',
      'UserGettingBored', // lol
      /Vim([A-Z][a-z]+)+/,
      /Win([A-Z][a-z]+)+/,
    )),

    augroup_statement: $ => seq(
      'augroup',
      token.immediate(optional('!')),
      // $.identifier,
      alias(/[^\r\n]+/, $.identifier),
      optional(seq(
        repeat1($.autocmd_statement),
        'augroup',
        'END',
      )),
      $._separator,
    ),

    heredoc_statement: $ => seq(
      // $.heredoc_language,
      choice('lua', 'perl', 'python', 'py3', 'ruby'),
      choice(
        seq(
          '<<',
          optional($.heredoc_start),
          $.heredoc_content,
          $.heredoc_end,
        ),
        // anything till next line
        alias($.oneliner_heredoc_content, $.heredoc_content),
      ),
    ),

    default_option: $ => seq($.option_identifier, '&', optional(choice('vi', 'vim'))),

    dictionary: $ => seq(
      '{',
      commaSep($.dictionary_entry),
      optional(','),
      '}',
    ),

    dictionary_entry: $ => seq(
      field('key', $.expression),
      ':',
      field('value', $.expression),
    ),

    // :h literal-Dict
    _literal_dictionary_entry: $ => seq(
      field('key', alias(/[0-9a-zA-Z_-]+/, $.identifier)),
      ':',
      field('value', $.expression),
    ),

    literal_dictionary: $ => seq(
      '#{',
      commaSep($._literal_dictionary_entry),
      optional(','),
      '}',
    ),

    list: $ => seq('[', sep($.expression, choice(',', ';')), optional(','), ']'),
    // Trailing commas are not allowed in assignments, but `; <ident>` are
    list_assignment: $ => seq(
      '[',
      commaSep($.expression),
      optional(seq(';', $.expression)),
      ']',
    ),

    finish: _ => choice(
      'fini',
      'finish',
    ),

    unknown_builtin_command: $ => seq(
      // $.identifier,
      // token.immediate(optional('!')),
      // choice(repeat($.command_argument), $.if_statement),
      $._unknown_builtin_command,
      $._separator, // FIXME: ~+150 state count w/ prec.right
    ),

    _unknown_builtin_command: $ => prec.right(seq(
      choice($.identifier),
      token.immediate(optional('!')),
      choice(repeat($.command_argument), $.if_statement),
    )),

    // unknown_builtin_statement: $ => (seq(
    //   $.identifier,
    //   choice($.if_statement),
    // )),

    string: $ => choice($._string, $._literal_string),

    _string: $ => seq(
      '"',
      repeat(choice(
        $.string_content,
        $._escape_sequence,
      )),
      '"',
    ),

    _literal_string: $ => seq(
      '\'',
      repeat(alias($.literal_string_content, $.string_content)),
      '\'',
    ),

    string_content: $ => choice(token(prec(1, /[^"\r\n\\]+/)), $._separator), // runtime/autoload/health/provider.vim is why we have separator here
    literal_string_content: _ => prec(1, choice(
      /[^']+/,
      alias('\'\'', '\''),
    )),

    _escape_sequence: $ =>
      choice(
        prec(2, token.immediate(seq('\\', /[^abfnrtvxu'"\\?]/))),
        prec(1, $.escape_sequence),
      ),
    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /[^xu0-7]/,
        /[0-7]{1,3}/,
        /x[0-9a-fA-F]{2}/,
        /u[0-9a-fA-F]{4}/,
        /u{[0-9a-fA-F]+}/,
        /U[0-9a-fA-F]{8}/,
      ),
    )),

    command_argument: $ => choice($.string, alias(/"[^\r\n]+/, $.comment), /[^\s]+/),

    number: _ => /\d+/,

    relative_number: _ => /\.[+-]?\d+/,

    _identifier: $ => choice(
      $.identifier,
      $.unique_identifier,
      $.keyword_identifier,
      $.namespace_identifier,
      $.argument,
      $.scoped_identifier,
      $.indirect_reference_identifier,
    ),

    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    unique_identifier: $ => prec.right(seq(/<[sS][iI][dD]>/, choice($._identifier, $.key))),

    keyword_identifier: $ => alias(
      prec(-3, choice(
        'call',
        'for',
        'function',
        'map',
        'nmap',
        'vmap',
        'xmap',
        'smap',
        'omap',
        'imap',
        'lmap',
        'cmap',
        'tmap',
        'noremap',
        'vnoremap',
        'nnoremap',
        'xnoremap',
        'snoremap',
        'onoremap',
        'inoremap',
        'lnoremap',
        'cnoremap',
        'tnoremap',
        'lua',
        'perl',
        'python',
        'py3',
        'ruby',
      )),
      $.identifier,
    ),

    scoped_identifier: $ => prec.right(seq(
      $.scope,
      optional($._identifier),
    )),

    namespace_identifier: $ => sep2(choice($.identifier, $.keyword_identifier), '#'),

    field_identifier: $ => seq(
      $._identifier,
      token.immediate('.'),
      sep1(choice($.identifier, $.string), token.immediate('.')),
    ),

    indirect_reference_identifier: $ => choice(
      seq('{', $.expression, '}', $._identifier),
      seq($.identifier, token.immediate('{'), $.expression, '}'),
    ),

    option: $ => seq('&', optional($.scope), $.option_identifier),

    option_identifier: _ => choice(/[a-z]+/, seq('t_', /[a-zA-Z0-9]+/)),

    scope: _ => token(seq(choice('b', 'g', 'l', 's', 't', 'v', 'w', '<'), ':')),

    argument: $ => prec.right(seq(
      'a:',
      choice($._identifier, $.number),
    )),

    register: _ => token(choice(/@["0-9a-zA-Z:.%#=*\+_/-@]/, '_')),

    // TODO: EXTERNAL SCANNER
    _bare_key: $ => alias(
      choice(
        token(/[a-zA-Z0-9\[\]\{\}\-\$%*^+`'"/?_,\x01\x08][a-zA-Z0-9\[\]\{\}\-%\$/*^+`'"/?_,\x1b]*/),
        token(prec(-1, /[a-zA-Z0-9\[\]\{\}\-%\$*^+`'"/?_,=\x01\x08][a-zA-Z0-9\[\]\{\}\-%\$/*^+`'"/?_,=<>\x1b]*/)),
      ),
      $.bare_key,
    ),

    regex_pattern_statement: $ => seq(
      choice('/', '?'),
      /[^\r\n]+/,
      $._separator,
    ),

    env_variable: _ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

    hl_group: _ => /[a-zA-Z0-9_@.]+/,

    filename: _ => token(prec(-1, seq(
      // First character of a filename is not immediate
      choice(
        /[A-Za-z0-9]/,
        /[/._+,#$%~=-]/,
        // Include windows characters
        /[\\{}\[\]:@!]/,
        // Allow wildcard
        /[*]/,
        // Escaped character
        seq('\\', /./),
      ),
      repeat(
        choice(
          ...[
            /[A-Za-z0-9]/,
            /[/._+,#$%~=-]/,
            // Include windows characters
            /[\\{}\[\]:@!]/,
            // Allow wildcard
            /[*]/,
            // Escaped character
            seq('\\', /./),
          ].map(token.immediate),
        ),
      ),
    ))),

    comment: _ => token(prec(-1, seq('"', /[^\r\n]*/))),
  },
});

module.exports.PREC = PREC;

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return sep1(rule, ',');
}

/**
  * Creates a rule to match zero or more of the rules separated by a comma
  * @param {Rule} rule
  * @return {ChoiceRule}
  */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
* Creates a rule to match zero or more of the rules separated by the separator
*
* @param {Rule} rule
* @param {string|Rule} separator - The separator to use.
*
* @return {ChoiceRule}
*
*/
function sep(rule, separator) {
  return optional(seq(rule, repeat(seq(separator, rule))));
}

/**
* Creates a rule to match one or more of the rules separated by the separator
*
* @param {Rule} rule
* @param {string|Rule} separator - The separator to use.
*
* @return {SeqRule}
*
*/
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

/**
* Creates a rule to match two or more of the rules separated by the separator
*
* @param {Rule} rule
* @param {string|Rule} separator - The separator to use.
*
* @return {SeqRule}
*
*/
function sep2(rule, separator) {
  return seq(rule, repeat1(seq(separator, rule)));
}
