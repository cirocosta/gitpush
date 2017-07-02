PRETTIER 	:= ./node_modules/.bin/prettier
ESLINT 		:= ./node_modules/.bin/eslint
TAP 			:= ./node_modules/.bin/tap

test:
	$(TAP) test/*.js

fmt:
	$(PRETTIER) \
		--single-quote \
		--no-bracket-spacing \
		--trailing-comma es5 \
		--write \"{test/**/*.js,*.js}\" 
	$(ESLINT) \
		--fix "*.js"

 
.PHONY: test fmt
