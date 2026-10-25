// Web-only stand-in for react-native-maps (it has no web version). Used only when the phone app is
// previewed in a browser during development; the real phone app always uses the real maps.
const { View, Text } = require('react-native');
const React = require('react');
function MapView(props) {
  return React.createElement(View, { style: [{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#18212B' }, props.style] },
    React.createElement(Text, { style: { color: '#A3AFBA' } }, 'Map preview is available on the phone only'));
}
const Nothing = () => null;
module.exports = { __esModule: true, default: MapView, Marker: Nothing, Polygon: Nothing, Polyline: Nothing, Circle: Nothing, PROVIDER_GOOGLE: 'google' };
