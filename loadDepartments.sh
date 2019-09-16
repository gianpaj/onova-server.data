#!/usr/bin/env bash

# Exit if a pipeline returns non-zero. Append "|| true" if you expect an error.
set -o errexit
# Strict Mode - Do not allow use of undefined vars. Use ${VAR:-} to use an undefined VAR
set -o nounset

# Return value of a pipeline is the value of the last (rightmost) command to
# exit with a non-zero status, or zero if all commands in the pipeline exit
# successfully.
set -o pipefail

# Turn on traces, useful while debugging but commented out by default
# set -o xtrace

# Print a helpful message if a pipeline with non-zero exit code causes the
# script to exit as described above.
trap 'echo "Aborting due to errexit on line $LINENO. Exit code: $?" >&2' ERR

# Allow the above trap be inherited by all functions in the script.
#
# Short form: set -E
set -o errtrace

set -u

while getopts ":u:p:" o; do
  case "${o}" in
    u)
      u=${OPTARG}
      ;;
    p)
      p=${OPTARG}
      ;;
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

usage() {
   printf "Error: Missing Username and Pass for UAPAY.\\n\\n";
   echo 'e.g. bash loadDepartments.sh -u g56gf56fg -p ds34d5';
   exit 1;
}

if [ -z "${u-}" ] || [ -z "${p-}" ]; then
  usage
fi

_simple() {
  printf "Loading Nova Poshta Departments and Cities into MongoDB.\\n"

  DATE=`date -u +"%Y-%m-%dT%H-%M-%SZ"`
  JSONFILE="cities-$DATE.json"
  curl -s --user "$u:$p" "https://api.escrowbox.uapay.ua/api/handlers/NovaPoshta/cities" | sed -e 's/{"data"://' | sed -e 's/}]}/}]/' > $JSONFILE

  echo "$JSONFILE created"

  mongoimport -d onova-data -c cities $JSONFILE --jsonArray --drop

  node loadDepartments.js $u $p
}


_main() {
  # Avoid complex option parsing when only one program option is expected.
  if [[ "${1:-}" =~ ^-h|--help$ ]]
  then
    _print_help
  else
    _simple "$@"
  fi
}

# Call `_main` after everything has been defined.
_main "$@"
