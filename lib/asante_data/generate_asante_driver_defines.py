#!/usr/bin/env python
# encoding: utf-8
"""
generate_asante_driver_defines.py

This file reads XML files produced by Asante; they are generally called datadesc.xml,
but I have renamed them here to include the version number in the filename. However,
the version number actually used in the generation is the one found
inside the file.

This program generates a JavaScript module for inclusion in the Asante driver.

These files are used internally to generate the pump software, so we are
using them to help with the generation of the Tidepool Uploader device driver
for the Asante pumps.

FAIR WARNING: Asante has chosen a strategy where the implementation of the
protocol values is dependent on the items in this file, AND their order. They
also have occasionally chosen to insert items into the middle of a list or to
change the names of items.

This means that new data file may not "just work" -- be sure to test it well and
examine differences between different versions carefully.

It's also the case that because the XML file is not fully specified, some portions
of it are not used -- for example, the subtypes for EVENT_TYPES are not extracted
automatically because the XML file doesn't call them out in a useful way. There
is manual code in the driver to handle these subtypes. Compare it to the generated
data manually!

Originally created by Kent Quirk on 02/13/15.
Copyright (c) 2015 Tidepool Project. All rights reserved.
"""

import os
import re
import sys
import argparse
import xml.etree.ElementTree as ET

def getStructKey(name, types):
    standards = {
        'char': 'z',
        'crc': 's',
        'int16_t': 'h',
        'int32_t': 'n',
        'int8_t': 'b',
        'time_in_secs': 'i',
        'time_no_offset': 'i',
        'uint16_t': 's',
        'uint32_t': 'i',
        'uint8_t': 'b',
        'enum8': 'b',
        'enum16': 's',
        'bit': 'b'
    }

    if name in standards:
        return standards[name]

    typekeys = dict([(i['name'], i['datatype']) for i in types])
    if name in typekeys:
        return standards[typekeys[name]]

    return '!'


def createId(s):
    return '_'.join(re.split('[^A-Za-z0-9_]+', s))

def createText(s):
    # trim off any xx_ at the beginning
    pat = re.compile('^[a-z][a-z]_')
    if pat.match(s):
        return s[3:]
    else:
        return s

def parseUserList(list):
    ulist = dict(name=list.attrib['name'], datatype=list.attrib['type'], rows=[])
    counter = 0
    for i in list.find('values'):
        ulist['rows'].append(dict(name=createId(i.text), text=createText(i.text), value=counter))
        counter += 1
    return ulist

def generateUserList(list):
    userlistTemplate = """
        %(listname)s: {
%(rows)s
        }"""
    rowTemplate = "           %(name)s: { value: %(value)d, name: '%(text)s'}"
    rows = []
    for row in list['rows']:
        rows.append(rowTemplate % row)
    result = userlistTemplate % dict(listname=list['name'], rows=',\n'.join(rows))
    return result

def parseUserLists(userLists):
    parsed = [parseUserList(i) for i in userLists]
    return parsed

def generateUserLists(parsed):
    lists = [generateUserList(i) for i in parsed]
    results = "    userlist: {\n%s\n    }," % ',\n'.join(lists)
    return results

def getBool(elem, attr):
    b = elem.get(attr, False)
    if b == 'false' or b == 'False':
        return False
    elif b == 'true' or b == 'True':
        return True
    else:
        return b

def compressStruct(s):
    '''
    Compresses a string by preceding runs of duplicated characters
    with the count of the number of characters.
    '''
    output = ''
    i1 = 0
    i2 = 0
    while i1 < len(s):
        i2 = i1
        while i2 < len(s) and s[i2] == s[i1]:
            i2 += 1
        if i2 > i1 + 1:
            output += str(i2 - i1)
        output += s[i1]
        i1 = i2

    return output


def parseDataRecords(files, types):
    records = []
    for f in files:
        record = dict(
            text=f.attrib['name'],
            name='_'.join(f.attrib['name'].upper().split(' ')),
            id=int(f.attrib['id']),
            maxrecs=int(f.attrib['maxrecs']),
            rectype=f.attrib['type'],
            fields=[]
        )
        fields = f.findall('field')
        for fld in fields:
            record['fields'].append(dict(
                name=fld.attrib['name'],
                fldtype=fld.attrib['type'],
                size=fld.get('size', None),
                padding=getBool(fld, 'ispadding')
                ))
        records.append(record)
    for r in records:
        struct = ''
        r['keys'] = []
        for f in r['fields']:
            if (f['padding']):
                s = '.'
            else:
                s = getStructKey(f['fldtype'], types)
                if (f['size'] != None):
                    s = str(f['size']) + s
            struct += s
            if s != '.':
                r['keys'].append(f['name'])
            r['struct'] = compressStruct(struct)
            r['orig'] = struct

    return records

def generateDataRecords(recs):
    recTemplate = """
        %(name)s: {
            value: %(id)d,
            name: '%(text)s',
            max: %(maxrecs)d,
            type: '%(rectype)s',
            struct: '%(struct)s',
            fields: %(keylist)s
        },
    """
    output = '    recordTypes: {\n'
    for rec in recs:
        fields = ["                '%s'" % k for k in rec['keys']]
        rec['keylist'] = '[\n' + ',\n'.join(fields) + '\n            ]'
        output += recTemplate % rec
    output += '\n    }'
    return output

def generateHeader(vars):
    header = """/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 *
 * THIS IS A GENERATED FILE -- DO NOT EDIT
 * Regenerate it by using generate_asante_driver_defines.py.
 */
 'use strict';

 module.exports = {
    pumpVersion: %(version)s,
"""
    return header % vars

def generateFooter(vars):
    footer = """
};
"""
    return footer % vars

def process(filename):
    try:
        tree = ET.parse(filename)
    except IOError:
        return []

    data = tree.getroot()
    version = data.attrib['framversion']
    userLists = data.find('userLists')
    types = parseUserLists(userLists)

    files = data.findall('file')
    dataRecords = parseDataRecords(files, types)

    output1 = generateUserLists(types)
    output2 = generateDataRecords(dataRecords)
    outputfile = open('asante_pump_version_%s.js' % version, 'w')
    outputfile.write(generateHeader(dict(version=version)))
    outputfile.write(output1)
    outputfile.write('\n')
    outputfile.write(output2)
    outputfile.write('\n')
    outputfile.write(generateFooter(dict(version=version)))
    return []

def main(argv=None):
    parser = argparse.ArgumentParser(description='Generates driver definition files for the asante driver for Tidepool')
    # arg*<tab>
    parser.add_argument(dest="files", nargs='+',
                    help="specify one or more XML files", metavar="FILE")
    args = parser.parse_args()
    if len(args.files) < 1:
        print ("You must specify one or more XML files to process.")
        exit(1)

    for filename in args.files:
        results = process(filename)
        for i in results:
            print ("Generated %s" % i)
    #print args
    return 0

if __name__ == "__main__":
    rv = main()
    if rv:
        sys.stderr.write("Failed. Use --help for full instructions.\n")
        sys.exit(rv)
    else:
        sys.exit(0)
