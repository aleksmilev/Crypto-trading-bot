#!/bin/bash

cleanup() {
  echo -e "\nCleaning up..."
  rm -f dump_res.txt
  echo "Exiting script."
  exit 0
}

trap cleanup INT

run_forever() {
  while true; do
    if [[ "$1" == "-f" || "$1" == "-full" ]]; then
      OUTPUT_FILE="dump_res.txt"

      touch "$OUTPUT_FILE"
      > "$OUTPUT_FILE"

      process_template() {
        local TEMPLATE_FILE="./dump.txt"
        local OUTPUT_FILE=$1

        while IFS= read -r LINE; do
          if [[ $LINE =~ \{\{(.*)\}\} ]]; then
            COMMAND=${BASH_REMATCH[1]}
            COMMAND=$(echo "$COMMAND" | xargs)
            get_content "$COMMAND" >> "$OUTPUT_FILE"
          else
            echo "$LINE" >> "$OUTPUT_FILE"
          fi
        done < "$TEMPLATE_FILE"
      }

      process_template "$OUTPUT_FILE"

      echo "Project information has been collected into $OUTPUT_FILE."

    else
      DIRECTORY=$1

      if [ -z "$DIRECTORY" ]; then
        echo "Please provide a directory to traverse."
        exit 1
      fi

      if [ ! -d "$DIRECTORY" ]; then
        echo "Directory $DIRECTORY does not exist."
        exit 1
      fi

      OUTPUT_FILE="dump_res.txt"

      touch "$OUTPUT_FILE"
      > "$OUTPUT_FILE"

      echo -e "\n\nThe code of the $DIRECTORY container is:\n" >> "$OUTPUT_FILE"

      get_directory_content "$DIRECTORY" "$OUTPUT_FILE"

      echo "Directory content has been saved into $OUTPUT_FILE."
    fi

    sleep 5
  done
}

get_content() {
  local COMMAND=$1
  if eval "$COMMAND" &>/dev/null; then
    eval "$COMMAND"
  else
    echo "Command failed: $COMMAND"
  fi
}

get_directory_content() {
  local DIR=$1
  local OUTPUT_FILE=$2

  for ITEM in "$DIR"/*; do
    local BASE_NAME=$(basename "$ITEM")

    if [[ "$BASE_NAME" == ".env" || "$BASE_NAME" == "node_modules" || "$BASE_NAME" == "dist" ]]; then
      continue
    fi

    if [ -d "$ITEM" ]; then
      echo -e "\n\nThe code of the $BASE_NAME container is:\n" >> "$OUTPUT_FILE"
      get_directory_content "$ITEM" "$OUTPUT_FILE"
    elif [ -f "$ITEM" ]; then
      FILE_NAME=$(basename "$ITEM")
      FILE_CONTENT=$(cat "$ITEM")

      echo "- $FILE_NAME -" >> "$OUTPUT_FILE"
      echo "$FILE_CONTENT" >> "$OUTPUT_FILE"
      echo "- end of the file -" >> "$OUTPUT_FILE"
      echo -e " " >> "$OUTPUT_FILE"
    fi
  done
}

run_forever "$@"