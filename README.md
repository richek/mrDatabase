# mrDatabase™ 

A client/server database system for JSON objects (key:value pairs).

## Features

	* Browser client for users.

	* Terminal client for administration.

	* RAM-based databases for high performance.

	* Concurrent encrypted disk-based databases for secure retention.

	* Automatic deleted object space recovery.

	* Client interfaces encrypted with HTTPS.

	* Browser client uses Javascript + jQuery.

	* Server and admin client use Nodejs + Javascript.

	* Asynchronous server I/O for high performance and scalability.

	* Single server instance manages multiple databases.

	* It's FREE. See LICENSE.md.

## Usage

As configured in the download package, the admin client runs on the same system as the server, using "localhost" as the domain name. This means administration requires access to the system running the server.

### SSL Certificates

For production, replace the SSL certificates in the Cert directory with certificates whose trust chain leads to a known Certificate Authority. In this case, remove Cert/root.pem, and remove the "ca" entry from the httpsOptions object in server.js and admin.js.

The server certificate (server.pfx) must use the correct Fully Qualified Domain Name (FQDN) as the Common Name (CN), or it must appear as a Subject Alternative Name (SAN). The server certificate must also serve the "localhost" domain.

If the SSL certificate file names are changed, make the appropriate changes in the httpsOptions object in server.js and admin.js.

### Server

In any configuration, the following files must be in the same directory as server.js:

	* Object.js
	* Cert/server.pfx
	* Cert/root.pem
	* dbFile.js
	* dbIndex.js
	* fuzzy.js
	* index.css
	* index.html
	* index.js
	* indexbad.html

To start the server:

```bash
	cd server_dir				# server_dir = server.js directory
	node server					# server uses port = 8888
```

__Note:__ The httpsOptions object near the top of server.js, and admin.js can be changed to specify a different port.

	* Databases are files with filename extensions = ".mrdb".
	* The server automatically opens all the databases it finds in its own directory.
	* Each database is read-only or read/write depending on the file's permissions.

To shut down the server:

	* admin.js includes a "shutdown" command to shut down the server.
	* A control-C (^C) also makes the server perform an orderly shutdown.

### Case and Fuzzy Match

Commands, search and index keys and values are converted internally to lower case. Thus, all are functionally case insensitive. Keys and values in an object are not modified.

Internally, the objects {Lastname:Smith}, {lastname:Smith}, {LASTNAME:SMITH}, and {lastname:smith} are all the same object.

__Note:__ Database names and their ".mrdb" extensions __are__ case sensitive.

By default, the server performs a fuzzy match for values, unless the criteria value ends with an underscore ("_"), in which case (pun intended) the server performs an exact case-insensitive match (not including the underscore).

The browser client provides an "exact" checkbox for each value, which adds the underscore automatically.

The fuzzy search algorithm is simple. Each and every character in the criteria value must find a match in the candidate value in sequence. Thus, "on" will match "John", but "no" or "onx" will not match "John".

### Browser Client

Because the download package root certificate (Cert/root.pem) is self-signed, the browser most likely will complain that it cannot validate the connection. This is expected in the download package environment. It can safely be overridden.

To connect the browser to the server, use this URL (pppp = server port):

	https://localhost:pppp

__Note__: The browser must be the latest version of Safari, Firefox, or Chrome.

If the server is listening at port 443, the URL does not have to specify the port.

The browser client cannot create a new database. That requires using the admin client.

Any client can add objects with new keys to a read/write database.

No clients can add objects to a read-only database.

### Administration Client

In any configuration, the following files must be in the same directory as the admin client:

	* Cert/admin.pfx
	* Cert/root.pem

__Note:__ The admin client must refer to the correct server FQDN and port. The httpsOptions object near the top of admin.js can be changed to refer to a different FQDN and/or port.

To see usage information and a list of available commands for the admin client:

```bash
	cd admin_dir				# admin_dir = admin.js location
	node admin
```

This provides the following display:

```
	Usage: node admin command [<dbName>] ['<object>' | true | false | anything]

	Commands:

		get <dbName> '<object>'
		put <dbName> '<object>'
		remove <dbName> '<object>'
		load <dbName> [<anything>]
		dump <dbName>
		log [true | false]
		getInfo
		rescan
		shutdown
```

__Note:__ In the usage display, '\<object\>' refers to a JSON object. The single quotes are required to escape command line processing.

### Commands

The primary commands are "get", "put", and "remove", and they are the only commands available in the browser client.

If the database is read-only, "put" and "remove" are not available in either client.

#### get

This command uses JSON search objects that specify criteria for retrieval. The key:value pairs in an individual search object have an AND relationship. In a JSON array of search objects, the objects have an OR relationship.

Thus, assuming a database with objects containing first and last names

```bash
	node admin get people '{firstname:john, lastname:smith}'
```

retrieves all objects that have both the firstname = "john" AND the lastname = "smith",

while

```bash
	node admin get dbname '[{firstname:john}, {lastname:smith}]'
```

retrieves all objects that have either the firstname = "john" OR the lastname = "smith", or both.

#### put

This command adds objects to the database.

The server does not permit duplicate objects in a database. The server sends the client a copy of each object added to the database. If the object already exists in the database, the server sends a "null".

#### remove

This command does exactly the same thing as the "get" command, except it also removes each retrieved object from the database.

#### load, dump, log, getInfo, rescan, shutdown

These commands are available only in the admin client.

#### load

This command creates a new database and loads objects into a new or existing database. It requires a dbName and an optional argument, which can be anything. Only its presence or absence is significant.

If the optional argument is present, the load command expects "dbName.csv" to be a tab-separated csv file, and "dbName.keys" to be a file of keys that correspond to the fields of each line of the csv file. Each line of the csv file contains the values of one object, and each line of the keys file contains one key.

If the optional argument is absent, the load command expects "dbName.txt" to be a list of JSON objects to load into the database. Each line of the text file must be a single JSON object or an array of JSON objects.

#### dump

This command returns the entire specified database to the client. It is intended to be a development tool.

#### log

This command displays or sets the current log state of the server. If the log state is "true", the server displays each command received on the console.

#### getInfo

This command returns the name, read-only status, and keys of every database currently recognized by the server.

#### rescan

This command makes the server re-scan its directory and recognize any new databases that have been added. Then it performs a getInfo and returns the information.

#### shutdown

This command makes the server perform an orderly shutdown.

## Examples

The following four example databases are included in the download package:

	* books
	* capitals
	* presidents
	* songs

Use the following files with the admin load command to create their respective databases:
	
	* books.csv
	* books.keys
	* capitals.txt
	* presidents.txt
	* songs.csv
	* songs.keys

Thanks for reading me. Comments and suggestions are welcome.
