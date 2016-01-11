# mrDatabase™ 

A __Nodejs__-based client/server database system for JSON objects (key:value pairs).

## Features

	* Server and admin client use Nodejs + Javascript.

	* Browser client uses Javascript + jQuery.

	* Browser client for users.

	* Terminal admin client for administration.

	* RAM-based databases for high performance.

	* Concurrent disk-based databases for retention.

	* Automatic deleted object space recovery.

	* Client/Server communication encrypted with HTTPS.

	* Asynchronous server I/O for high performance and scalability.

	* Single server instance manages multiple databases.

	* No schema--just JSON objects with key:value pairs.

	* It's FREE. See LICENSE.md.

## Usage

As configured in the download package, the admin and browser clients run on the same system as the server, using "localhost" as the domain name.

### HTTPS

All communication between the server and clients uses HTTPS. The directory specified by **options.certs** contains demo certificates for HTTPS, but the root certificate being self-signed may cause browser clients to require the user to take responsibility for the "insecure" connection.

__Note:__ The **options.certs** values in the server and the admin client do not have to be the same. The server does not reference "client.pfx", and the admin client does not reference "server.pfx".

The server listens at **options.httpsPort** (8888) for HTTPS connections.

The **options** object at the top of server.js configures the port for HTTPS. The **httpsOptions** object at the top of admin.js configures its HTTPS port. If you change the port, make sure the admin client's **httpsOptions.port** is identical to the server's **options.httpsPort**.

### SSL Certificates

For production, replace the SSL certificates in the **options.certs** directory with certificates whose trust chain leads to a known Certificate Authority.

The server certificate (server.pfx) must use the correct Fully Qualified Domain Name (FQDN) as the Common Name (CN), or it must appear as a Subject Alternative Name (SAN). The download package server certificate serves only the "localhost" domain.

### Server

In any configuration, the following files--or their links--must be in the same directory as server.js:

	* Object.js
	* dbFile.js
	* dbIndex.js
	* index.css
	* index.html
	* index.js
	* indexbad.html

The "server.pfx" file--or its link--must be in the **options.certs** directory.

The database files--or their links--must be in the **options.dbPath** directory.

To start the server:

```bash
	cd server_dir				# server_dir = server.js directory
	node server
```
* Databases are files--or links--with filename extensions = ".mrdb".
* The server automatically opens all the databases it finds in the **options.dbPath** directory.
* Each database is read-only or read/write depending on the file's permissions.

To shut down the server:

	* The admin client includes a "shutdown" command to shut down the server.
	* A control-C (^C) also makes the server perform an orderly shutdown.

### Case and Fuzzy Match

 Internally, the server converts commands, keys, and values to strings.

 Commands are converted to lower case, making them case insensitive.

 Keys can be multiple words separated by a space. Keys are converted to lower case, and sequences of multiple spaces are reduced to a single space. Spaces at the beginning and end of a key are removed.

 Values also can be multiple words separated by a space. Values have sequences of multiple spaces reduced to a single space, and spaces at the beginning and end of a value are removed. Values retain their case in the stored object.

 Values are compared in lower case. Thus, "Houston", "HOUSTON", and "houston" are considered identical values.

__Note:__ Database names and their ".mrdb" extensions __are__ case sensitive.

By default, the server performs a fuzzy match for values, unless the search criteria value ends with an equal sign ("="), in which case (pun intended) the server performs an exact case-insensitive match (not including the equal sign). A value that ends with an equal sign ("=") can be used in a fuzzy search by appending it with a tilde ("~"). The appended tilde ("~") forces a fuzzy match regardless of whether the value ends with an equal sign ("=").

The browser client provides an "exact" checkbox for each value, which appends the equal sign automatically. If the box is unchecked, the browser client appends a tilde ("~").

The fuzzy search algorithm is simple. Each and every character in the search criteria value must find a match in the candidate value in sequence. Thus, "on" will match "John", but "no" or "onx" will not match "John".

### Browser Client

The download package root certificate is self-signed. The browser client most likely will complain that it cannot validate the connection. This is expected in the download package environment.

To connect the browser to the server, use this URL (pppp = the **options.httpsPort** specified in the server):

	http://localhost:pppp

__Note__: The browser must be the latest version of Safari, Firefox, or Chrome.

The browser client cannot create a new database. That requires using the admin client.

Any client can add objects with new keys to a read/write database.

No clients can add objects to a read-only database.

### Admin Client

In any configuration, the following file--or its link--must be in the directory specified by **options.certs**:

	* client.pfx

__Note:__ The admin client must refer to the correct server FQDN and port. You can change the **httpsOptions** object near the top of admin.js to refer to a different FQDN and/or port, as long as they match the server's.

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

__Note:__ All admin client commands are case insensitive.

### Commands

The primary commands are "get", "put", and "remove", and they are the only commands available to the browser client.

If the database is read-only, "put" and "remove" are not available to either client.

#### get

This command uses JSON search objects that specify search criteria for retrieval. The key:value pairs in an individual search object have an AND relationship. In a JSON array of search objects, the objects have an inclusive OR relationship.

Thus, assuming a database named "people" with objects containing first and last names:

```bash
	node admin get people '{"first name":"john", "last-name":"smith"}'
```

retrieves all objects that have both the firstname = "john" AND the lastname = "smith",

while

```bash
	node admin get people '[{"first name":"john"}, {"last name":"smith"}]'
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

This command creates a new empty database and executes a "rescan" command. It has no effect on an existing database.

#### import

This command executes a "create" command and imports objects into the database.

The import command expects to find "dbName.csv" in the server's **options.dbPath** directory to be a tab-separated csv file. Each line of the csv file contains the tab-separated values of one object. The first line contains the tab-separated keys that correspond to the values in subsequent lines.

#### export

This command exports the database to a tab-separated csv file ("dbName.csv") in the server's **options.dbPath** directory. Each line of the csv file contains the tab-separated values of one object. The first line contains the tab-separated keys that correspond to the values in subsequent lines.

#### dump

This command returns the entire specified database to the client. It's handy for testing.

#### log

This command displays or sets the current log state of the server. If the log state is "true", the server displays each command received on its console. The default log state is "false".

#### getInfo

This command returns the name, read-only status, and keys of every database currently recognized by the server.

#### rescan

This command makes the server re-scan its **options.dbPath** directory, recognize any new databases that have been added, and forget any databases that have been removed. Then it performs a getInfo and returns the information.

#### shutdown

This command orders the server to perform an orderly shutdown.

## Examples

Use the admin "import" command with each of the following download package files to create and import their respective databases:
	
	* books.csv
	* capitals.csv
	* presidents.csv
	* songs.csv

```bash
	node admin import books
	node admin import capitals
	node admin import presidents
	node admin import songs
```

Thanks for reading me. Comments and suggestions are welcome.
