# OpenDiabetesVault-Suite
This project provides a package for the [Atom](https://atom.io) text editor which allows for programming [OpenDiabetesFilters](https://github.com/Edgxxar/OpenDiabetesFilter) using [Google Blockly](https://developers.google.com/blockly/).

## Installation
There are two methods to install this package: Through the atom package registry or by cloning the repository manually to your local file system.

### Requirements
You need to have the following software installed on your system for this package to work:

##### For execution on your native System (recommended for testing):
* [Java Development Kit](https://www.oracle.com/technetwork/java/javase/downloads/index.html) (Version 8 or newer)
  * Make sure to install the JDK (Java Development Kit), not the JRE (Java Runtime Environment)
  * The `JAVA_HOME` path should be set in your systems environment
  * Test your Java installation by executing the following commands in a terminal:
    * `java -version`
    * `javac -version` To check if the java compiler is available
* [Python 3](https://www.python.org/downloads/)
  * Test your Python installation by executing the following command in a terminal:
    * `python -V`
  * The following python libraries need to be installed: `matplotlib`, `numpy`, `iso8601`, `configparser`
  * Install the libraries with pip3, which should be included in your python installation.
  * Open a terminal and execute: `pip3 install matplotlib numpy iso8601 configparser`

##### OR for execution with Docker:
* [Docker Desktop](https://www.docker.com/products/docker-desktop) or another Docker installation that runs on your local system
  * The following Docker images need to be installed:
    * [OpenDiabetesVault](https://github.com/OpenDiabetes/OpenDiabetesVault)
    * [Plotteria](https://github.com/OpenDiabetes/OpenDiabetesVault-plot)
  * Either install the images by cloning the repository to your local file system and running the following commands:
    * `docker build -t odv .` inside the OpenDiabetesVault directory
    * `docker build -t plotteria .` inside the Plotteria directory
  * OR directly build them via GitHub:
    * `docker build -t odv https://github.com/OpenDiabetes/OpenDiabetesVault.git`
    * `docker build -t plotteria https://github.com/OpenDiabetes/OpenDiabetesVault-plot.git`

Obviously you need to have [Atom](https://atom.io) installed and running.

### Automatic Installation
1. Start Atom
1. Open the Settings (`ctrl`+`,`)
1. Navigate to the `Install` menu
1. Search for `open-diabetes-vault-suite`
1. Click install
1. Restart atom if you are prompted to do so

### Manual Installation
The following guide will install this package locally with your atom editor. You do not have to do this if you installed this package with the Atom package registry.
You need to have [Git](https://git-scm.com/) and [NodeJS](https://nodejs.org/en/download/) installed on your system. 

1. clone the repository into any directory
   * `git clone https://github.com/OpenDiabetes/OpenDiabetesVault-Suite`
1. open a terminal and navigate into the directory
1. execute `npm install`
1. execute `apm link`
1. reload (`ctrl`+`shift`+`F5`) or restart your atom editor
1. check that the package was installed in the settings (`ctrl`+`,`)
   1. you may have to press the `Enable` button to enable the package. Then reload atom again.

## Settings
To open the settings navigate to *Packages* > *Open Diabetes Filter* > *Settings* or press `ctrl`+`alt`+`l`.

By default open-diabetes-vault-suite will use the native ODV CLI and Plot generator executables that are shipped with this repository.
If you want to use Docker, select the *Use Docker* checkbox in the settings. 
If you want to use a custom ODV CLI or Plot generator, uncheck the *Use built-in ODV CLI* or *Use built-in Plot generator* checkboxes and specify the paths to your executables with the setting below the checkbox. 

You can check that everything is working correctly by using the *Packages* > *Open Diabetes Filter* > *Check Settings* Menu.

## Keyboard shortcuts
Currently the following keyboard shortcuts open the different views:

| Shortcut | Action |
|----------|--------|
| `ctrl`+`alt`+`o` | Filter editor (Blockly) |
| `ctrl`+`alt`+`p` | Plot view |
| `ctrl`+`alt`+`l` | Open Settings |
