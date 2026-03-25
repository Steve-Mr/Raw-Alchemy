import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# Mocking colour before importing core
sys.modules['colour'] = MagicMock()
sys.modules['rawpy'] = MagicMock()
sys.modules['numba'] = MagicMock()
sys.modules['raw_alchemy.utils'] = MagicMock()
sys.modules['raw_alchemy.config'] = MagicMock()
sys.modules['raw_alchemy.logger'] = MagicMock()
sys.modules['raw_alchemy.metering'] = MagicMock()
sys.modules['raw_alchemy.file_io'] = MagicMock()

from raw_alchemy.core import _read_lut_cached

class TestLUTCache(unittest.TestCase):
    def test_read_lut_cached(self):
        import colour
        colour.read_LUT = MagicMock(return_value="mock_lut")

        lut_path = "test.cube"

        # First call
        result1 = _read_lut_cached(lut_path)
        self.assertEqual(result1, "mock_lut")
        colour.read_LUT.assert_called_once_with(lut_path)

        # Second call with same path
        result2 = _read_lut_cached(lut_path)
        self.assertEqual(result2, "mock_lut")
        # Should still be called once
        colour.read_LUT.assert_called_once()

        # Call with different path
        lut_path2 = "test2.cube"
        result3 = _read_lut_cached(lut_path2)
        self.assertEqual(result3, "mock_lut")
        self.assertEqual(colour.read_LUT.call_count, 2)

if __name__ == '__main__':
    unittest.main()
