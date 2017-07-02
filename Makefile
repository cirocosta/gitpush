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
		--write "{lib/**/*.js,test/**/*.js,*.js}" 
	$(ESLINT) \
		--fix "{lib/**/*.js,test/**/*.js,*.js}"

 
.PHONY: test fmt
