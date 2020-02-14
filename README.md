# tagcloud4settlements

## Overview

Web application which shows tag-cloud of account's quarterly settlements.


## Pre-requisites

Before running import.js, you need to put quarterly materials of company account in ./pdfs/ folder with following filename format:

- Company_Name.YYYY.nn.pdf

  - Company_Name : display name of company(with out period)

  - YYYY : 4 digit year

  - nn : serial number of YYYY. This could be quaterly index number( 1, 2, 3, and 4 ), but this doesn't has to be.

  - For example, `ABC株式会社.2020.1.pdf` , that would be the first material of ABC株式会社 year of 2020.


## Import materials

- `$ node import`

  - This command would import material information under ./pdfs/ folder into system.

  - You can add materials anytime, but you need to run this command again.


## References

- https://github.com/dotnsf/mecab-nodejs.git


## License

This code is licensed under MIT.


## Copyright

2020 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
