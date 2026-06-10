import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

export const PageTitle: React.FC<TextProps> = ({ style, children, ...props }) => {
  return (
    <Text style={[styles.pageTitle, style]} {...props}>
      {children}
    </Text>
  );
};

export const PageSubtitle: React.FC<TextProps> = ({ style, children, ...props }) => {
  return (
    <Text style={[styles.pageSubtitle, style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 26,
    fontFamily: Fonts.black,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 10,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
