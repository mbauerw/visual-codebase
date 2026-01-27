#!/bin/bash

git branch -a --sort=-committerdate --format='%(committerdate:short) %(refname:short) %(objectname:short) %(subject)'
