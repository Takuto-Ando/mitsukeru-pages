import json
import unittest
from unittest.mock import patch
import collect_commons as collector


class CollectionTests(unittest.TestCase):
    def page(self, title='File:Goat.jpg', license='CC BY-SA 4.0', author='Photographer'):
        return {'pageid': 12, 'title': title, 'imageinfo': [{
            'mime': 'image/jpeg', 'width': 900, 'height': 600,
            'sha1': 'fixture', 'url': 'https://upload.wikimedia.org/photo.jpg',
            'extmetadata': {key: {'value': value} for key, value in {
                'LicenseShortName': license, 'Artist': author,
                'ImageDescription': 'Goat at a zoo',
                'LicenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/'
            }.items()}
        }]}

    def search(self, page):
        with patch.object(collector, 'request', return_value=json.dumps({'query': {'pages': {'12': page}}}).encode()) as request:
            rows = collector.search('goat', '"Capra hircus"', 12)
            self.assertNotIn('%28', request.call_args.args[0])
            return rows

    def test_records_provenance_and_requires_review(self):
        row = self.search(self.page())[0]
        self.assertEqual(row['reviewStatus'], 'pending')
        self.assertFalse(row['splitAssigned'])
        self.assertEqual(row['author'], 'Photographer')
        self.assertTrue(row['sourcePage'].startswith('https://commons.wikimedia.org/'))
        self.assertNotIn('split', row)

    def test_non_photos_and_unclear_permissions_are_excluded(self):
        for page in [self.page(title='File:Goat skeleton.jpg'),
                     self.page(license='All rights reserved'), self.page(author='')]:
            self.assertEqual(self.search(page), [])

    def test_unexpected_download_hosts_rejected_before_network(self):
        with self.assertRaises(ValueError):
            collector.request('https://example.com/photo.jpg')

    def test_fresh_test_excludes_previous_photographers_and_ids(self):
        response = json.dumps({'query': {'pages': {'12': self.page()}}}).encode()
        with patch.object(collector, 'request', return_value=response):
            self.assertEqual(collector.search('goat', 'goat', 8, {'commons-12'}, set()), [])
            self.assertEqual(collector.search('goat', 'goat', 8, set(), {'Photographer'}), [])


if __name__ == '__main__':
    unittest.main()
