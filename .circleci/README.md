# CircleCI configuration #

If you want to generate a new CircleCI configuration, edit the relevant files (do not touch `config.yml` in the current directory) and then run:

```shell
cd kubernetes-monitor
circleci config pack .circleci/config > .circleci/config.yml
circleci config validate .circleci/config.yml
```

Check in your changes and the re-generated `config.yml`.
