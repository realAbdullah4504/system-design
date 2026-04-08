#!/bin/bash

mkdir -p export/sns

TOPICS=$(aws sns list-topics --query "Topics[].TopicArn" --output text)

for T in $TOPICS; do
  NAME=$(basename $T)

  aws sns get-topic-attributes \
    --topic-arn $T \
    > export/sns/$NAME.json

  aws sns list-subscriptions-by-topic \
    --topic-arn $T \
    > export/sns/${NAME}_subs.json
done