# tagcloud4settlements

## Overview

Web application which shows tag-cloud of account's quarterly settlements.


## Data import

We provide **2** data import tools, **import.js** and **import_url.js**. You can choose both tool which you like.

### Pre-requisites for import.js

Before running import.js, you need to put quarterly materials of company account in **./pdfs/** folder with following filename format:

- Company_Name.YYYY.nn.pdf

  - Company_Name : display name of company(with out period)

  - YYYY : 4 digit year

  - nn : serial number of YYYY. This could be quaterly index number( 1, 2, 3, and 4 ), but this doesn't has to be.

  - For example, `ABC株式会社.2020.1.pdf` , that would be the first material of ABC株式会社 year of 2020.

### Import materials with import.js

- `$ node import`

  - This command would import material information under ./pdfs/ folder into system.

  - You can add materials anytime, but you need to run this command again.

### Pre-requisites for import_url.js

Before running import_url.js, you need to prepare URL information of quarterly materials of company account in **./pdfs.csv** with following line format:

- URL,output filename

  - URL : public URL of PDF

  - output filename : filename of PDF file, which would be id in database.

    - For example, `ABC株式会社.2020.1.pdf` , that would be the first material of ABC株式会社 year of 2020.

### Import materials with import_url.js

- `$ node import_url`

  - This command would import material information with ./pdfs.csv file into system.

  - You can add materials anytime, but you need to run this command again.

  - Downloaded PDF file would be saved under ./pdfs folder.



## References

- https://github.com/dotnsf/mecab-nodejs.git


## License

This code is licensed under MIT.


## Copyright

2020 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
