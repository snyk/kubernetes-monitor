all: clean test build

clean:

build:
	docker build -t snyk-k8s-monitor .

install:
	pip install -r requirements.txt

test: export PYTHONPATH=.
test:
	python -m unittest discover ./tests

.PHONY: all clean build install test