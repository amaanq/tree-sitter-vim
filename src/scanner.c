#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <tree_sitter/parser.h>
#include <wctype.h>

enum TokenType {
    LINE_CONTINUATION,
    SEPARATOR,
    KEYCODE_CONTENT,
    KEYCODE_SEPARATOR,
    END_KEYCODE,
    FORMAT_BLOB,
    FORMAT_SPACE,
    TOKEN,
    /* STARTING_PERIOD, */
    /* HEREDOC_LANGUAGE, */
    HEREDOC_START,
    HEREDOC_CONTENT,
    ONELINER_HEREDOC_CONTENT,
    HEREDOC_END,
    /* SUBSTITUTION_COMMAND, */
};

typedef struct {
    char *HEREDOC_LANGUAGE;
    int   HEREDOC_LANGUAGE_LENGTH;
    char *HEREDOC_START;
    int   HEREDOC_START_LENGTH;
    char  SUBSTITUTION_DELIMITER;
} Scanner;

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static void reset(char *buffer) { memset(buffer, 0, 20); }

void *tree_sitter_vim_external_scanner_create() {
    Scanner *scanner = malloc(sizeof(Scanner));

    scanner->HEREDOC_LANGUAGE = malloc(20);
    reset(scanner->HEREDOC_LANGUAGE);
    scanner->HEREDOC_LANGUAGE_LENGTH = 0;

    scanner->HEREDOC_START = malloc(20);
    reset(scanner->HEREDOC_START);
    scanner->HEREDOC_START_LENGTH = 0;

    return scanner;
}

void tree_sitter_vim_external_scanner_destroy(void *payload) { free(payload); }

void tree_sitter_vim_external_scanner_reset(void *payload) {}

unsigned tree_sitter_vim_external_scanner_serialize(void *payload,
                                                    char *buffer) {
    unsigned len = sizeof(Scanner);
    memcpy(buffer, payload, len);
    return len;
}

void tree_sitter_vim_external_scanner_deserialize(void       *payload,
                                                  const char *buffer,
                                                  unsigned    length) {
    if (length > 0) {
        assert(sizeof(Scanner) == length);
        memcpy(payload, buffer, sizeof(Scanner));
    }
}

/* const char *valid_languages[] = {"lua", "perl", "python", "py3", "ruby"}; */
/**/
/* bool scan_heredoc_language(Scanner *scanner, TSLexer *lexer) { */
/**/
/*   while (iswspace(lexer->lookahead)) */
/*     skip(lexer); */
/**/
/*   // get the word of the language */
/*   while (iswalnum(lexer->lookahead)) { */
/*     scanner->HEREDOC_LANGUAGE[scanner->HEREDOC_LANGUAGE_LENGTH] = */
/*         lexer->lookahead; */
/*     scanner->HEREDOC_LANGUAGE_LENGTH++; */
/*     if (scanner->HEREDOC_LANGUAGE_LENGTH == 20) { */
/*       reset(scanner->HEREDOC_LANGUAGE); */
/*       scanner->HEREDOC_LANGUAGE_LENGTH = 0; */
/*       return false; */
/*     } */
/*     advance(lexer); */
/*   } */
/**/
/*   // check if language is valid */
/*   for (int i = 0; i < 5; i++) { */
/*     if (strcmp(scanner->HEREDOC_LANGUAGE, valid_languages[i]) == 0) { */
/*       lexer->result_symbol = HEREDOC_LANGUAGE; */
/**/
/*       reset(scanner->HEREDOC_LANGUAGE); */
/*       scanner->HEREDOC_LANGUAGE_LENGTH = 0; */
/**/
/*       return true; */
/*     } */
/*   } */
/**/
/*   reset(scanner->HEREDOC_LANGUAGE); */
/*   scanner->HEREDOC_LANGUAGE_LENGTH = 0; */
/*   return false; */
/* } */

bool scan_keycode_content(Scanner *scanner, TSLexer *lexer) {
    // Anything but [sS][iI][dD] and [bB][aA][rR] and > means end
    lexer->result_symbol = KEYCODE_CONTENT;
    while (lexer->lookahead != '>' && lexer->lookahead != '<' &&
           !iswspace(lexer->lookahead) && lexer->lookahead != '\0' &&
           lexer->lookahead != '-') {
        if (lexer->lookahead == 's' || lexer->lookahead == 'S') {
            lexer->mark_end(lexer);
            advance(lexer);
            if (lexer->lookahead == 'i' || lexer->lookahead == 'I') {
                advance(lexer);
                if (lexer->lookahead == 'd' || lexer->lookahead == 'D') {
                    return false;
                }
            }
        } else if (lexer->lookahead == 'b' || lexer->lookahead == 'B') {
            lexer->mark_end(lexer);
            advance(lexer);
            if (lexer->lookahead == 'a' || lexer->lookahead == 'A') {
                advance(lexer);
                if (lexer->lookahead == 'r' || lexer->lookahead == 'R') {
                    advance(lexer);
                    return false;
                }
            }
        } else if (lexer->lookahead == 'c' || lexer->lookahead == 'C') {
            lexer->mark_end(lexer);
            advance(lexer);
            if (lexer->lookahead == 'r' || lexer->lookahead == 'R') {
                advance(lexer);
                if (lexer->lookahead == '>') {
                    return false;
                }
            }
        } else {
            lexer->mark_end(lexer);
            advance(lexer);
        }
    }

    if (iswspace(lexer->lookahead))
        return false;

    lexer->mark_end(lexer);
    return true;
}

/* // just <[cC][rR]> */
bool scan_end_keycode(Scanner *scanner, TSLexer *lexer) {
    if (lexer->lookahead == '<') {
        lexer->result_symbol = END_KEYCODE;
        advance(lexer);
        if (lexer->lookahead == 'c' || lexer->lookahead == 'C') {
            advance(lexer);
            if (lexer->lookahead == 'r' || lexer->lookahead == 'R') {
                advance(lexer);
                if (lexer->lookahead == '>') {
                    advance(lexer);
                    return true;
                }
            }
        }
    }
    return false;
}

bool scan_oneliner_heredoc_content(Scanner *scanner, TSLexer *lexer) {
    while (iswspace(lexer->lookahead))
        skip(lexer);

    lexer->result_symbol = ONELINER_HEREDOC_CONTENT;
    if (lexer->lookahead == '<') {
        lexer->mark_end(lexer);
        advance(lexer);
        if (lexer->lookahead == '<')
            return false;
    }

loop:
    while (lexer->lookahead != '\r' && lexer->lookahead != '\n' &&
           lexer->lookahead != '\0' && lexer->lookahead != '<')
        advance(lexer);

    // check for <CR>
    if (lexer->lookahead == '<') {
        lexer->mark_end(lexer);
        advance(lexer);
        if (lexer->lookahead == 'c' || lexer->lookahead == 'C') {
            advance(lexer);
            if (lexer->lookahead == 'r' || lexer->lookahead == 'R') {
                advance(lexer);
                if (lexer->lookahead == '>') {
                    advance(lexer);
                    return true;
                }
            }
        }
    } else {
        lexer->mark_end(lexer);
        return true;
    }
    goto loop;
}

bool scan_heredoc_content(Scanner *scanner, TSLexer *lexer) {
    while (iswspace(lexer->lookahead))
        skip(lexer);
    lexer->result_symbol = HEREDOC_CONTENT;
    for (;;) {
        if (lexer->lookahead == '\0') {
            lexer->mark_end(lexer);
            return true;
        }

        if (lexer->lookahead == scanner->HEREDOC_START[0]) {
            lexer->mark_end(lexer);
        }

        if (lexer->lookahead == '.' && scanner->HEREDOC_START_LENGTH == 0) {
            lexer->mark_end(lexer);
            advance(lexer);
            return true;
        }

        for (int i = 0; i < scanner->HEREDOC_START_LENGTH; i++) {
            if (lexer->lookahead == scanner->HEREDOC_START[i]) {
                advance(lexer);
                if (i == scanner->HEREDOC_START_LENGTH - 1) {
                    if (lexer->lookahead == '\n') {
                        advance(lexer);
                        return true;
                    }
                }
            } else {
                lexer->mark_end(lexer);
                break;
            }
        }

        advance(lexer);
    }
}

// Sike 🤣
/* bool scan_substitution_command(Scanner *scanner, TSLexer *lexer) { */
/**/
/* } */

bool tree_sitter_vim_external_scanner_scan(void *payload, TSLexer *lexer,
                                           const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;

    /* if (lexer->lookahead == ':' && lexer->get_column(lexer) == 0) { */
    /*     lexer->result_symbol = COLON; */
    /*     advance(lexer); */
    /* } */

    if (valid_symbols[SEPARATOR] && valid_symbols[LINE_CONTINUATION]) {
        while (iswspace(lexer->lookahead) && lexer->lookahead != '\n')
            skip(lexer);

        if (lexer->lookahead == '|' || lexer->lookahead == '\n') {
            advance(lexer);

            while (iswspace(
                lexer->lookahead) /* && lexer->lookahead != '\n'*/) // bruh lol
                                                                    // fuck
                                                                    // multiple
                                                                    // \ns then
                skip(lexer);

            if (lexer->lookahead == '|') // or operator
                return false;

            if (lexer->lookahead == '\\') { // line continuation
                lexer->result_symbol = LINE_CONTINUATION;
                advance(lexer);
                lexer->mark_end(lexer);

                if (lexer->lookahead == '|') {
                    advance(lexer);
                    if (lexer->lookahead == '|') { // ||
                        advance(lexer);
                        return true;
                    }

                    lexer->result_symbol = SEPARATOR;
                    lexer->mark_end(lexer);
                    return true;
                }

                lexer->result_symbol = LINE_CONTINUATION;
                return true;
            } else {
                lexer->result_symbol = SEPARATOR;
                return true;
            }
        }
    }

    if (valid_symbols[TOKEN]) {
        // anything but ws
        while (iswspace(lexer->lookahead))
            skip(lexer);

        if (lexer->lookahead == '\0')
            return false;

        if (lexer->lookahead == '"') {
            lexer->result_symbol = TOKEN;
            advance(lexer);
            if (iswspace(lexer->lookahead)) {
                return false;
            }
        }

        if (lexer->lookahead != '\0' && !iswspace(lexer->lookahead)) {
            lexer->result_symbol = TOKEN;
            while (lexer->lookahead != '\0' && !iswspace(lexer->lookahead)) {
                advance(lexer);
            }
            return true;
        }
        return false;
    }

    if (valid_symbols[KEYCODE_CONTENT])
        return scan_keycode_content(scanner, lexer);

    if (valid_symbols[KEYCODE_SEPARATOR]) {
        if (lexer->lookahead == '-') {
            lexer->result_symbol = KEYCODE_SEPARATOR;
            advance(lexer);
            return true;
        } else {
            return false;
        }
    }

    if (valid_symbols[END_KEYCODE]) {
        while (iswspace(lexer->lookahead) && lexer->lookahead != '\n')
            skip(lexer);
        return scan_end_keycode(scanner, lexer);
    }

    if (valid_symbols[FORMAT_BLOB]) {
        // start with %, end until newline or comma AT the end
        /* if (lexer->lookahead == '%') { */
        lexer->result_symbol = FORMAT_BLOB;
        advance(lexer);

    loop:
        while (lexer->lookahead != '\n' && lexer->lookahead != ',') {
            advance(lexer);
        }
        lexer->mark_end(lexer);
        if (lexer->lookahead == ',') {
            advance(lexer);
            if (lexer->lookahead == '\n') {
                return true;
            } else {
                goto loop;
            }
        }
        return true;
    }

    if (valid_symbols[FORMAT_SPACE]) {
        if (lexer->lookahead == '\\') {
            lexer->result_symbol = FORMAT_SPACE;
            advance(lexer);
            if (lexer->lookahead == ' ') {
                advance(lexer);
                return true;
            }
        }
    }

    /* if (valid_symbols[STARTING_PERIOD]) { */
    /*   printf("lookahead: %c, column: %d\n", lexer->lookahead, */
    /*          lexer->get_column(lexer)); */
    /*   if (lexer->lookahead == '.' && lexer->get_column(lexer) == 0) { */
    /*     advance(lexer); */
    /*     return true; */
    /*   } */
    /* } */

    /* if (valid_symbols[HEREDOC_LANGUAGE]) { */
    /*   return scan_heredoc_language(scanner, lexer); */
    /* } */

    if (valid_symbols[HEREDOC_END]) {
        if (scanner->HEREDOC_START_LENGTH == 0) {
            while (iswspace(lexer->lookahead) && lexer->lookahead != '\n')
                skip(lexer);
            if (lexer->lookahead == '.') {
                advance(lexer);
                return true;
            }
        } else {
            while (iswspace(lexer->lookahead))
                skip(lexer);
            lexer->result_symbol = HEREDOC_END;
            // Check if heredoc end matches heredoc start
            for (int i = 0; i < scanner->HEREDOC_START_LENGTH; i++) {
                if (lexer->lookahead == scanner->HEREDOC_START[i]) {
                    advance(lexer);
                    if (i == scanner->HEREDOC_START_LENGTH - 1) {
                        if (lexer->lookahead == '\n') {
                            advance(lexer);
                            reset(scanner->HEREDOC_START);
                            reset(scanner->HEREDOC_LANGUAGE);
                            scanner->HEREDOC_START_LENGTH = 0;
                            scanner->HEREDOC_LANGUAGE_LENGTH = 0;
                            return true;
                        }
                    }
                } else {
                    return false;
                }
            }
        }

        return false;
    }

    if (valid_symbols[HEREDOC_START]) {
        while (iswspace(lexer->lookahead) && lexer->lookahead != '\n')
            skip(lexer);

        if (lexer->lookahead == '\n') {
            skip(lexer);
            return scan_heredoc_content(scanner, lexer);
        }

        lexer->result_symbol = HEREDOC_START;

        // Store heredoc start in HEREDOC_START_CHAR
        while (iswalnum(lexer->lookahead)) {
            scanner->HEREDOC_START[scanner->HEREDOC_START_LENGTH] =
                lexer->lookahead;
            scanner->HEREDOC_START_LENGTH++;
            advance(lexer);
        }
        return true;
    }

    if (valid_symbols[ONELINER_HEREDOC_CONTENT])
        return scan_oneliner_heredoc_content(scanner, lexer);

    if (valid_symbols[HEREDOC_CONTENT])
        return scan_heredoc_content(scanner, lexer);

    return false;
}
