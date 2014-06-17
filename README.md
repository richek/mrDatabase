# mrDatabase™ 

A client/server database system for JSON objects (key:value pairs).

## Features

	* Browser client for users.

	* Terminal client for administration.

	* RAM-based databases for high performance.

	* Concurrent encrypted disk-based databases for secure retention.

	* Automatic deleted object space recovery.

	* Client interfaces optionally encrypted with HTTPS.

	* Browser client uses Javascript + jQuery.

	* Server and admin client use Nodejs + Javascript.

	* Asynchronous server I/O for high performance and scalability.

	* Single server instance manages multiple databases.

	* No schema--just JSON objects with key:value pairs.

	* It's FREE. See LICENSE.md.

## Usage

As configured in the download package, the admin client runs on the same system as the server, using "localhost" as the domain name. This means administration requires access to the system running the server.

### HTTP and HTTPS

By default, the download package is configured to use HTTP. This enables testing and demonstration without requiring SSL certificates for browser clients. At the top of server.js is an options object containing "secure: false". Change "false" to "true" to switch to HTTPS. The Cert directory contains test/demo certificates for HTTPS, but the root certificate being self-signed may cause problems with browsers.

__Note:__ The admin client always uses HTTPS for security purposes.

As configured, the server uses port 8888 for HTTP, and port 8889 for HTTPS. When running in secure mode, browsers addressing the HTTP port will automatically be redirected to the HTTPS port. The admin client always uses the HTTPS port.

The options object at the top of server.js configures the ports for HTTP and HTTPS. The httpsOptions object at the top of admin.js configures its HTTPS port. You can change these configuration ports, but the admin client's httpsOptions.port must be identical to the server's options.HTTPS port.

### SSL Certificates

For secure production, change options.secure at the top of server.js from "false" to "true", and replace the SSL certificates in the Cert directory with certificates whose trust chain leads to a known Certificate Authority. In this case, remove Cert/root.pem, and remove the "ca" entry from the httpsOptions object near the top of server.js and admin.js.

The server certificate (server.pfx) must use the correct Fully Qualified Domain Name (FQDN) as the Common Name (CN), or it must appear as a Subject Alternative Name (SAN). The server certificate must also serve the "localhost" domain for the admin client.

If you change the SSL certificate file names, make the appropriate changes in the httpsOptions object near the top of server.js and admin.js.

### Server

In any configuration, the following files must be in the same directory as server.js:

	* Object.js
	* Cert/server.pfx
	* Cert/root.pem
	* dbFile.js
	* dbIndex.js
	* index.css
	* index.html
	* index.js
	* indexbad.html

To start the server:

```bash
	cd server_dir				# server_dir = server.js directory
	node server					# server uses ports 8888 and 8889
```

__Note:__ You can change the options object near the top of server.js to specify different ports. If you change the HTTPS port, be sure to change httpsOptions.port near the top of admin.js to the identical port.

	* Databases are files with filename extensions = ".mrdb".
	* The server automatically opens all the databases it finds in its own directory.
	* Each database is read-only or read/write depending on the file's permissions.

To shut down the server:

	* The admin client includes a "shutdown" command to shut down the server.
	* A control-C (^C) also makes the server perform an orderly shutdown.

### Case and Fuzzy Match

 Internally, the server converts commands, keys, and values to strings. It converts search and index keys and values to lower case. Thus, all are functionally case insensitive. Keys and values in objects themselves are not converted to lower case.

Internally, the objects {Lastname:Smith}, {lastname:Smith}, {LASTNAME:SMITH}, and {lastname:smith} are all the same object. However, the object {lastname:smith} is __not__ the same as the object {lastname:smith, firstname:john}.

__Note:__ Database names and their ".mrdb" extensions __are__ case sensitive.

By default, the server performs a fuzzy match for values, unless the search criteria value ends with an underscore ("_"), in which case (pun intended) the server performs an exact case-insensitive match (not including the underscore).

The browser client provides an "exact" checkbox for each value, which adds the underscore automatically.

The fuzzy search algorithm is simple. Each and every character in the search criteria value must find a match in the candidate value in sequence. Thus, "on" will match "John", but "no" or "onx" will not match "John".

### Browser Client

The download package root certificate (Cert/root.pem) is self-signed. When using secure mode without replacing the SSL certificates, the browser most likely will complain that it cannot validate the connection. This is expected in the download package environment.

To connect the browser to the server, use this URL (pppp = server port):

	http://localhost:pppp

__Note__: The browser must be the latest version of Safari, Firefox, or Chrome.

If the server is listening at port 80, the URL does not have to specify the port.

The browser client cannot create a new database. That requires using the admin client.

Any client can add objects with new keys to a read/write database.

No clients can add objects to a read-only database.

### Administration Client

In any configuration, the following files must be in the same directory as the admin client:

	* Cert/admin.pfx
	* Cert/root.pem

__Note:__ The admin client must refer to the correct server FQDN and port. You can change the httpsOptions object near the top of admin.js to refer to a different FQDN and/or port, as long as they match the server's.

To see usage information and a list of available commands for the admin client:

```bash
	cd admin_dir				# admin_dir = admin.js location
	node admin
```

This provides the following display:

```bash
	Usage: node admin command [<dbName>] ['<object>' | true | false]

	Commands:

		get <dbName> '<object>'
		put <dbName> '<object>'
		remove <dbName> '<object>'
		create <dbName>
		import <dbName>
		export <dbName>
		dump <dbName>
		log [true | false]
		getInfo
		rescan
		shutdown
```

__Note:__ In the usage display, "object" refers to a JSON object. The single quotes are required to escape shell command line processing.

### Commands

The primary commands are "get", "put", and "remove", and they are the only commands available to the browser client.

If the database is read-only, "put" and "remove" are not available to either client.

#### get

This command uses JSON search objects that specify search criteria for retrieval. The key:value pairs in an individual search object have an AND relationship. In a JSON array of search objects, the objects have an OR relationship.

Thus, assuming a database named "people" with objects containing first and last names

```bash
	node admin get people '{firstname:john, lastname:smith}'
```

retrieves all objects that have both the firstname = "john" AND the lastname = "smith",

while

```bash
	node admin get people '[{firstname:john}, {lastname:smith}]'
```

retrieves all objects that have either the firstname = "john" OR the lastname = "smith", or both.

#### put

This command adds objects to the database.

The server does not permit duplicate objects in a database. The server sends the client a copy of each object added to the database. If the object already exists in the database, the server sends a "null".

#### remove

This command does exactly the same thing as the "get" command, except it also removes each retrieved object from the database. It's a good idea to do a "get" before a "remove" to make sure you are removing the objects you intend to remove.

#### create, import, export, dump, log, getInfo, rescan, shutdown

These commands are available only in the admin client.

#### create

This command creates a new empty database and executes a "rescan" command. If applied to an existing database, it has no effect except changing the database file timestamp.

#### import

This command executes a "create" command and imports objects into the database.

The import command expects "dbName.csv" to be a tab-separated csv file. Each line of the csv file contains the tab-separated values of one object. The first line contains the tab-separated keys that correspond to the values in subsequent lines.

#### export

This command exports the database to a tab-separated csv file. Each line of the csv file contains the tab-separated values of one object. The first line contains the tab-separated keys that correspond to the values in subsequent lines.

#### dump

This command returns the entire specified database to the client. It's handy for testing.

#### log

This command displays or sets the current log state of the server. If the log state is "true", the server displays each command received on its console.

#### getInfo

This command returns the name, read-only status, and keys of every database currently recognized by the server.

#### rescan

This command makes the server re-scan its directory and recognize any new databases that have been added. Then it performs a getInfo and returns the information.

#### shutdown

This command makes the server perform an orderly shutdown.

## Examples

Use the admin "import" command with each of the following files to create and import their respective databases:
	
	* books.csv
	* capitals.csv
	* presidents.csv
	* songs.csv

Thanks for reading me. Comments and suggestions are welcome.
