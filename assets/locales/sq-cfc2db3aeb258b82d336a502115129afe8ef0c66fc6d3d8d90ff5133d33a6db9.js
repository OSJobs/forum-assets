/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
r += "Keni ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 shkrim të palexuar</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " shkrime të palexuara</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "dhe ";
return r;
},
"false" : function(d){
var r = "";
r += "është ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 shkrim të ri</a>";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "dhe ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " shkrime të reja</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " akoma, ose ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "shiko temat e tjera në kategorinë ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "This topic has ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 reply";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " replies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>达到了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "你将删除该用户的";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "、该账户，并阻止其IP地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> 再次注册，并将其邮件地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> 加入黑名单。你确定这用户是广告散布者吗？";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "你将要删除 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个主题";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sq"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。确定吗？";
return r;
}};
MessageFormat.locale.sq = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"sq":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm (z)","timeline_date":"MMM YYYY","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} më parë","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}o","other":"%{count}o"},"x_days":{"one":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"%{count}v","other":"%{count}v"},"over_x_years":{"one":"\u003e %{count}v","other":"\u003e %{count}v"},"almost_x_years":{"one":"%{count}v","other":"%{count}v"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} min","other":"%{count} mins"},"x_hours":{"one":"%{count} orë","other":"%{count} orë"},"x_days":{"one":"%{count} ditë","other":"%{count} ditë"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} min më parë","other":"%{count} min më parë"},"x_hours":{"one":"%{count} orë më parë","other":"%{count} orë më parë"},"x_days":{"one":"%{count} ditë më parë","other":"%{count} ditë më parë"}},"later":{"x_days":{"one":"%{count} ditë më vonë","other":"%{count} ditë më vonë"},"x_months":{"one":"%{count} muaj më vonë","other":"%{count} muaj më vonë"},"x_years":{"one":"%{count} vit më vonë","other":"%{count} vjet më vonë"}},"previous_month":"Muaji i kaluar","next_month":"Muaji i ardhshëm"},"share":{"post":"postim #%{postNumber}","close":"mbylle"},"action_codes":{"public_topic":"e bëri këtë temë publike %{when}","split_topic":"ndaje këtë teme %{when}","invited_user":"ka ftuar %{who} %{when}","invited_group":"ka ftuar %{who} %{when}","user_left":"u larguan nga ky mesazh","removed_user":"hequr %{who} %{when}","removed_group":"hequr %{who} %{when}","autoclosed":{"enabled":"mbylli %{when}","disabled":"hapur %{when}"},"closed":{"enabled":"mbyllur %{when}","disabled":"hapur %{when}"},"archived":{"enabled":"arkivoi %{when}","disabled":"paarkivuar %{when}"},"pinned":{"enabled":"ngjitur %{when}","disabled":"çngjitur %{when}"},"pinned_globally":{"enabled":"ngjitur globalisht %{when}","disabled":"çngjitur %{when}"},"visible":{"enabled":"listuar %{when}","disabled":"çlistuar %{when}"}},"wizard_required":"Mirseerdhët tek faqja juaj e re Discourse! Le t'ia nisim me \u003ca href='%{url}' data-auto-route='true'\u003e\"setup wizard\"\u003c/a\u003e ✨","emails_are_disabled":"Emailat janë çaktivizuar globalisht nga administratori i faqes. Asnjë njoftim me email nuk do të dërgohet. ","themes":{"default_description":"Paracaktuar"},"s3":{"regions":{"ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","ap_south_1":"Asia Pacific (Mumbai)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","cn_north_1":"China (Beijing)","eu_central_1":"EU (Frankfurt)","eu_west_1":"EU (Ireland)","eu_west_2":"BE (Londër)","us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)"}},"edit":"redakto titullin dhe kategorinë e kësaj teme","expand":"Shpalos","not_implemented":"Kjo veçori nuk është implementuar akoma, na vjen keq!","no_value":"Jo","yes_value":"Po","generic_error":"Na vjen keq, por sapo ndodhi një gabim.","generic_error_with_reason":"Pati një gabim: %{error}","sign_up":"Regjistrohu","log_in":"Identifikohu","age":"Mosha","joined":"Anëtarësuar","admin_title":"Admin","show_more":"trego më shumë","show_help":"ndihmë dhe kërko me Google","links":"Lidhjet","links_lowercase":{"one":"lidhje","other":"lidhje"},"faq":"Pyetje të shpeshta","guidelines":"Udhëzimet","privacy_policy":"Politika e Privatësisë","privacy":"Privatësia","tos":"Kushtet e shërbimit","mobile_view":"Pamja për celular","desktop_view":"Pamja për desktop","you":"Ju","or":"ose","now":"tani","read_more":"lexo më shumë","more":"Më shumë","less":"Më pak","never":"asnjëherë","every_30_minutes":"çdo 30 minuta","every_hour":"çdo orë","daily":"çdo ditë","weekly":"çdo javë","max_of_count":"max i {{count}}","alternation":"ose","character_count":{"one":"{{count}} shkronjë","other":"{{count}} shkronja"},"suggested_topics":{"title":"Temat e sugjeruara","pm_title":"Mesazhet e sugjeruara"},"about":{"simple_title":"Rreth Faqes","title":"Rreth %{title}","stats":"Statistikat e faqjes","our_admins":"Administratorët tanë","our_moderators":"Moderatorët tanë","moderators":"Moderatorë","stat":{"all_time":"Gjithë kohës"},"like_count":"Pëlqime","topic_count":"Tema","post_count":"Postime","user_count":"Anëtarët","active_user_count":"Përdorues Aktivë","contact":"Na kontaktoni","contact_info":"Në rast të një problemi madhor ose të një çështjeje urgjente që prek faqen, ju lutemi të kontaktoni %{contact_info}."},"bookmarked":{"title":"Të preferuarat","clear_bookmarks":"Pastro të preferuarat","help":{"bookmark":"Kliko për të shtuar tek të preferuarat e tua postimin e parë të kësaj teme.","unbookmark":"Kliko për të hequr të preferuarat nga kjo temë"}},"bookmarks":{"created":"ju ruajtët këtë temë tek të preferuarat tuaja","remove":"Hiqeni nga të prefereruarat","save":"Ruaj"},"drafts":{"remove":"Hiq","abandon":{"yes_value":"Po, braktise","no_value":"Jo, mbaji"}},"preview":"shiko","cancel":"anulo","save":"Ruaj ndryshimet","saving":"Duke e ruajtur...","saved":"U ruajtën!","upload":"Ngarko","uploading":"Duke ngarkuar...","uploaded":"U ngarkua!","enable":"Aktivizo","disable":"Çaktivizo","undo":"Çbëj","revert":"Rikthe","failed":"Dështoi","switch_to_anon":"Filloni sesionin anonim","switch_from_anon":"Shkëputu nga sesioni anonim","banner":{"close":"Hiq këtë banderolë.","edit":"Modifiko këtë banderolë \u003e\u003e"},"choose_topic":{"none_found":"Asnjë temë nuk u gjet."},"review":{"in_reply_to":"në përgjigje të","explain":{"total":"Total"},"delete":"Fshij","settings":{"save_changes":"Ruaj ndryshimet","title":"Rregullimet"},"topic":"Tema:","filtered_user":"User","user":{"username":"Emri i përdoruesit","email":"Email","name":"Emri"},"topics":{"topic":"Topic"},"edit":"Redakto","save":"Ruaj","cancel":"Anulo","filters":{"type":{"title":"Lloji"},"refresh":"Rifresko","category":"Kategori"},"scores":{"type":"Lloji"},"statuses":{"pending":{"title":"Në pritje"},"rejected":{"title":"Rejected"}},"types":{"reviewable_user":{"title":"User"}},"approval":{"title":"Postimi ka nevojë për aprovim","description":"Postimi juaj u morr, por duhet të aprovohet nga një moderator para se të shfaqet në faqe. Kini pak durim. ","ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postoi \u003ca href='{{topicUrl}}'\u003etemën\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eJu\u003c/a\u003e postuat \u003ca href='{{topicUrl}}'\u003etemën\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e iu përgjigj \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eJu\u003c/a\u003e i jeni përgjigjur \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e iu përgjigj \u003ca href='{{topicUrl}}'\u003etemës\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eJu\u003c/a\u003e i jeni përgjigjur \u003ca href='{{topicUrl}}'\u003etemës\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e përmendi \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ju ka përmendur \u003ca href='{{user2Url}}'\u003eju\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eJu\u003c/a\u003e keni përmendur \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postuar nga \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postuar nga \u003ca href='{{userUrl}}'\u003eju\u003c/a\u003e","sent_by_user":"Dërguar nga \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Dërguar nga \u003ca href='{{userUrl}}'\u003eju\u003c/a\u003e"},"directory":{"filter_name":"filtro sipas emrit të anëtarit","title":"Anëtarët","likes_given":"Dhënë","likes_received":"Marrë","topics_entered":"Shikuar","topics_entered_long":"Temat e shikuara","time_read":"Koha e leximit","topic_count":"Tema","topic_count_long":"Topics Created","post_count":"Përgjigje","post_count_long":"Replies Posted","no_results":"Nuk u gjet asnjë rezultat.","days_visited":"Vizita","days_visited_long":"Vizita Ditore","posts_read":"Lexuar","posts_read_long":"Postimet e lexuara","total_rows":{"one":"%{count} anëtar","other":"%{count} anëtarë"}},"group_histories":{"actions":{"change_group_setting":"Ndrysho parametrin e grupit","add_user_to_group":"Shto anëtar","remove_user_from_group":"Hiq anëtar","make_user_group_owner":"Bëje autor","remove_user_as_group_owner":"Hiq autorin"}},"groups":{"add_members":{"title":"Shto anëtarë"},"requests":{"reason":"Arsye"},"manage":{"name":"Emri","full_name":"Emri i plotë","add_members":"Shto anëtarë","delete_member_confirm":"Do të heqësh '%{username}' nga grupi '%{group}'?","profile":{"title":"Profili"},"interaction":{"posting":"Postimet"},"logs":{"title":"Logs","when":"Kur","action":"Veprimi","acting_user":"Anëtari veprues","target_user":"Anëtari i prekur","subject":"Subjekti","details":"Detaje","from":"Nga","to":"Për"}},"public_admission":"Lejo që përdoruesit të bashkohen lirisht ne grupin (Kërkon grupin e dukshëm publik)","public_exit":"Lejo përdoruesit të largohen nga grupi lirshëm","empty":{"posts":"Nuk ka postime nga anëtarët e këtij grupi.","members":"Nuk ka anëtarë në këtë grup."},"add":"Shto","message":"Message","name":"Emri","user_count":"Users","bio":"Mbi grupin","selector_placeholder":"vendos emrin e përdoruesit","owner":"autori","index":{"title":"Grupet","automatic":"Automatik","automatic_group":"Grup automatik","my_groups":"Grupet e mia","is_group_user":"Anëtar"},"activity":"Aktiviteti","members":{"title":"Anëtarë","filter_placeholder_admin":"pseudonimin ose email","filter_placeholder":"emri i përdoruesit"},"topics":"Tema","posts":"Postime","mentions":"Përmendje","messages":"Mesazhet","alias_levels":{"nobody":"Asnjëri","only_admins":"Vetëm adminët","mods_and_admins":"Vetëm moderatorët dhe adminët","members_mods_and_admins":"Vetëm anëtarët e grupit, moderatorët dhe adminët","everyone":"Të gjithë"},"notifications":{"watching":{"title":"Në vëzhgim","description":"Ju do të njoftoheni për çdo postim të ri në çdo mesazh, dhe numri i ri i përgjigjeve të reja do të tregohet."},"watching_first_post":{"title":"Postimi i parë nën vëzhgim"},"tracking":{"title":"Në gjurmim","description":"Ju do të njoftoheni në qoftë se dikush ju pëmend me @emri ose ju përgjigjet, gjithashtu numri i përgjigjeve të reja do të tregohet."},"regular":{"title":"Normal","description":"Ju do të njoftoheni në qoftë se dikush ju përmend @emrin ose ju përgjigjet."},"muted":{"title":"Pa njoftime"}},"flair_preview_icon":"Parashiko ikonën","flair_preview_image":"Parashiko imazhin"},"user_action_groups":{"1":"Pëlqime të dhëna","2":"Pëlqime të marra","3":"Të preferuarat","4":"Tema","5":"Përgjigje","6":"Përgjigjet","7":"Përmendje","9":"Citime","11":"Redaktime","12":"Të dërguar","13":"Inbox","14":"Në pritje"},"categories":{"all":"kategoritë","all_subcategories":"të gjitha","no_subcategory":"asnjë","category":"Kategori","category_list":"Trego listën e kategorive","reorder":{"title":"Rendit kategoritë","title_long":"Ri-organizo listën e kategorive","save":"Ruaje renditjen","apply_all":"Apliko","position":"Pozicioni"},"posts":"Postime","topics":"Tema","latest":"Të fundit","latest_by":"e fundit nga","toggle_ordering":"toggle ordering control","subcategories":"Nënkategori","topic_sentence":{"one":"%{count} temë","other":"%{count} tema"}},"ip_lookup":{"title":"Shiko adresën IP","hostname":"Hostname","location":"Vendndodhja","location_not_found":"(i panjohur)","organisation":"Organizata","phone":"Telefoni","other_accounts":"Llogari të tjera me këtë adresë IP:","delete_other_accounts":"Fshi %{count}","username":"emri i përdoruesit","trust_level":"TL","read_time":"koha e leximit","topics_entered":"temat e shikuara","post_count":"# postimeve","confirm_delete_other_accounts":"A jeni të sigurtë që doni të fshini këto llogari?"},"user_fields":{"none":"(zgjidhni një opsion)"},"user":{"said":"{{username}}:","profile":"Profili","mute":"Hesht","edit":"Ndrysho preferencat","download_archive":{"confirm":"Vërtet doni t'i shkarkoni postimet tuaja?","success":"Shkarkimi filloi, do të njoftoheni me një mesazh kur të jetë gati. ","rate_limit_error":"Postimet mund të shkarkohen një herë në ditë, provoni përsëri nesër. "},"new_private_message":"Mesazh i ri","private_message":"Mesazh","private_messages":"Mesazhet","user_notifications":{"ignore_duration_username":"Emri i përdoruesit","mute_option":"Pa njoftime","normal_option":"Normal"},"activity_stream":"Aktiviteti","preferences":"Preferencat","feature_topic_on_profile":{"save":"Ruaj","clear":{"title":"Pastro"}},"expand_profile":"Shpalos","bookmarks":"Të preferuarat","bio":"Rreth meje","invited_by":"Të ftuar nga unë","trust_level":"Niveli i besimit","notifications":"Njoftimet","statistics":"Statistikat","desktop_notifications":{"not_supported":"Ky shfletues nuk është i aftë të ruajë njoftimet. ","perm_default":"Aktivizo njoftimet","perm_denied_btn":"Nuk lejohet","perm_denied_expl":"Ju nuk na dhatë të drejtën t'ju dërgojmë njoftime. Njoftimet mund t'i lejoni në rregullimet e shfletuesit tuaj. ","disable":"Çaktivizoni njoftimet","enable":"Aktivizoni njoftimet","each_browser_note":"Shënim: Duhet të ndryshoni këtë rregullim (setting) në çdo shfletues që përdorni. "},"dismiss":"Hiqe","dismiss_notifications":"Hiqini të gjitha","dismiss_notifications_tooltip":"Shëno njoftimet e palexuara si të lexuara","first_notification":"Njoftimi juaj i parë! Zgjidheni për të filluar. ","external_links_in_new_tab":"Hap të gjitha lidhjet e jashtme në një tab të ri","enable_quoting":"Aktivizo citimin në përgjigje për tekstin e përzgjedhur","change":"ndrysho","moderator":"{{user}} është moderator","admin":"{{user}} është admin","moderator_tooltip":"Ky anëtar është moderator","admin_tooltip":"Ky anëtar është administrator","suspended_notice":"Ky anëtar është përjashtuar deri më {{date}}.","suspended_reason":"Arsyeja:","github_profile":"Github","email_activity_summary":"Përmbledhja e aktivitetit","mailing_list_mode":{"individual":"Dërgo një email për çdo postim të ri","many_per_day":"Më dërgo një email për çdo postim të ri (rreth {{dailyEmailEstimate}} në ditë)","few_per_day":"Më dërgo një email për çdo postim të ri (rreth 2 në ditë)"},"tag_settings":"Etiketat","watched_tags":"Vëzhguar","watched_tags_instructions":"Ju do të vëzhgoni automatikisht të gjitha temat nën këtë etiketë. Do të njoftoheni për çdo postim e temë të re, dhe numri i postimeve të reja të palexuara do të afishohet ngjitur me titullin e temës përgjatë listave të faqes. ","tracked_tags":"Gjurmuar","tracked_tags_instructions":"Ju do të gjurmoni automatikisht të gjitha temat nën këtë etiketë. Numri i përgjigjeve të palexuara do të afishohet ngjitur me titullin e temës. ","muted_tags":"Të heshtur","muted_tags_instructions":"Ju nuk do të njoftoheni për asgjë nga temat e reja të këtyre etiketave, dhe këto tema nuk do të afishohen në faqen \"Më të fundit\" për ju. ","watched_categories":"Shikuar","watched_categories_instructions":"Ju do të vëzhgoni automatikisht të gjitha temat nën këtë kategori. Do të njoftoheni për çdo postim e temë të re, dhe numri i postimeve të reja të palexuara do të afishohet ngjitur me titullin e temës. ","tracked_categories":"Gjurmuar","tracked_categories_instructions":"Ju do të gjurmoni automatikisht të gjitha temat nën këtë kategori. Numri i përgjigjeve të palexuara do të afishohet ngjitur me titullin e temës. ","watched_first_post_categories":"Postimi i parë nën vëzhgim","watched_first_post_categories_instructions":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këto kategori.","watched_first_post_tags":"Postimi i parë nën vëzhgim","watched_first_post_tags_instructions":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këto etiketa.","muted_categories":"Pa njoftime","delete_account":"Fshi llogarinë time","delete_account_confirm":"Jeni i sigurtë që dëshironi ta mbyllni përgjithmonë llogarinë tuaj? Ky veprim nuk mund të zhbëhet!","deleted_yourself":"Llogaria juaj u fshi me sukses.","unread_message_count":"Mesazhet","admin_delete":"Fshi","users":"Anëtarët","muted_users":"Të heshtur","muted_users_instructions":"Çaktivizo të gjitha njoftimet nga këta anëtarë.","tracked_topics_link":"Shfaq","automatically_unpin_topics":"Çngjiti temat automatikisht kur arrij fundin e faqes.","apps":"Aplikimet","revoke_access":"Hiqi aksesin","undo_revoke_access":"Anullo heqjen e aksesit","api_approved":"Aprovuar më:","theme":"Tema","staff_counters":{"flags_given":"sinjalizime të dobishme","flagged_posts":"postimet e sinjalizuara","deleted_posts":"postimet e fshira","suspensions":"pezullimet","warnings_received":"paralajmërimet"},"messages":{"all":"Të gjitha","inbox":"Inbox","sent":"Të dërguara","archive":"Arkivi","groups":"Grupet e mia","bulk_select":"Zgjidh mesazhet","move_to_inbox":"Transfero në inbox","move_to_archive":"Arkivo","failed_to_move":"Nuk i transferuam dot mesazhet e zgjedhura (ka mundësi që të jeni shkëputur nga rrjeti)","select_all":"Zgjidh të gjitha","tags":"Etiketat"},"preferences_nav":{"account":"Llogaria","profile":"Profili","emails":"Emailat","notifications":"Njoftimet","categories":"Kategoritë","users":"Users","tags":"Etiketat","apps":"Aplikimet"},"change_password":{"success":"(emaili u dërgua)","in_progress":"(duke dërguar emailin)","error":"(gabim)","action":"Dërgo email për të rivendosur fjalëkalimin","set_password":"Vendos fjalëkalim","choose_new":"Zgjidhni një fjalëkalim të ri","choose":"Zgjidhni një fjalëkalim të ri"},"second_factor_backup":{"regenerate":"Rigjenero","disable":"Çaktivizo","enable":"Aktivizo"},"second_factor":{"name":"Emri","edit":"Redakto","security_key":{"delete":"Fshij"}},"change_about":{"title":"Ndrysho Rreth meje","error":"Pati një gabim gjatë ndryshimit të kësaj të dhëne."},"change_username":{"title":"Ndrysho emrin e përdoruesit","taken":"Na vjen keq, por ky emër është i zënë.","invalid":"Emri i përdoruesit nuk është i vlefshëm. Duhet të përmbaje vetëm shkronja ose numra"},"change_email":{"title":"Ndrysho email","taken":"Na vjen keq, por ky email nuk është i disponueshëm.","error":"Hasëm një gabim gjatë ndryshimit të adresës email. Mos vallë është në përdorim nga dikush tjetër?","success":"Ju dërguam një email tek adresa që shkruajtët. Ju ftojmë të ndiqni udhëzimet e konfirmimit.","success_staff":"Ju dërguam një email tek adresa që shkruajtët. Ju ftojmë të ndiqni udhëzimet e konfirmimit."},"change_avatar":{"title":"Ndrysho fotografinë e profilit","letter_based":"Foto e profilit e caktuar nga sistemi","uploaded_avatar":"Foto e personalizuar","uploaded_avatar_empty":"Shto një foto të personalizuar","upload_title":"Ngarkoni foton tuaj","image_is_not_a_square":"Vini re: fotoja juaj është përshtatur, pasi nuk ishte katrore."},"change_card_background":{"title":"Sfondi për skedën e anëtarit","instructions":"Sfondi do të vendoset në qendër dhe do të ketë një gjerësi prej 590px."},"email":{"title":"Email","instructions":"Mos e shfaq në publik.","ok":"Do ju nisim emailin e konfirmimit","invalid":"Ju lutemi të vendosni një email të vlefshëm","authenticated":"Emaili juaj është verifikuar nga {{provider}}","frequency_immediately":"Do t'ju dërgojmë një email menjëherë nëse nuk e keni lexuar temën për të cilën po ju dërgojmë email.","frequency":{"one":"Do t'ju dërgojmë një email vetëm nëse nuk të kemi parë në faqe në minutën e fundit.","other":"Do t'ju dërgojmë një email vetëm nëse nuk të kemi parë në faqe në {{count}} minutat e fundit."}},"associated_accounts":{"revoke":"Revoko","cancel":"Anulo"},"name":{"title":"Emri juaj","instructions":"emri i plotë (opsional)","instructions_required":"Emri i plotë","too_short":"Emri juaj është shumë i shkurtër","ok":"Emri duket në rregull"},"username":{"title":"Emri i përdoruesit","instructions":"unik, pa hapësira, i shkurtër","short_instructions":"Anëtarët e tjerë mund t'ju përmendin si @{{username}}","available":"Emri është i disponueshëm","not_available":"Nuk është i disponueshëm. Provoni {{suggestion}}?","not_available_no_suggestion":"I padisponueshëm","too_short":"Emri juaj është shumë i shkurtër","too_long":"Emri juaj është shumë i gjatë","checking":"Duke verifikuar disponibilitetin e emrit të përdoruesit....","prefilled":"Emaili u gjet në këtë përdorues të regjistruar"},"locale":{"title":"Gjuha e faqes","instructions":"Gjuha e faqes për përdoruesin. Do të ndryshojë pasi të rifreskoni faqen. ","default":"(paracaktuar)","any":"ndonjë"},"password_confirmation":{"title":"Rishkruani fjalëkalimin"},"auth_tokens":{"ip":"IP","details":"Detaje"},"last_posted":"Postimi i fundit","last_emailed":"Emaili i Fundit","last_seen":"Parë","created":"Regjistruar","log_out":"Shkëputu","location":"Vendndodhja","website":"Faqja web","email_settings":"Email","text_size":{"normal":"Normal"},"like_notification_frequency":{"title":"Njoftimet e pëlqimeve","always":"Gjithmonë","first_time_and_daily":"Herën e parë që një postim pëlqehet, dhe përditë ","first_time":"Herën e parë që një postim pëlqehet","never":"Asnjëherë"},"email_previous_replies":{"title":"Përfshi përgjigje të shkuara në njoftimet me email","unless_emailed":"nëse ishin dërguar më parë","always":"gjithmonë","never":"asnjëherë"},"email_digests":{"every_30_minutes":"çdo 30 minuta","every_hour":"çdo orë","daily":"çdo ditë","weekly":"çdo javë"},"email_level":{"title":"Më dërgo një email kur dikush më citon, i përgjigjet një postimi tim, më përmend me @username, ose më fton në një temë","always":"gjithmonë","never":"asnjëherë"},"email_messages_level":"Më dërgo një email kur dikush më dërgon një mesazh","include_tl0_in_digests":"Përfshini dhe postime nga anëtarët e rinj","email_in_reply_to":"Përfshi një copëz të përgjigjeve ndaj postimit në email","other_settings":"Tjetër","categories_settings":"Kategoritë","new_topic_duration":{"label":"Konsidero diskutimin të ri kur","not_viewed":"Nuk i kam shikuar akoma","last_here":"krijuar që herën e fundit që isha këtu","after_1_day":"krijuar në ditën e djeshme","after_2_days":"krijuar në 2 ditët e shkuara","after_1_week":"krijuar në javën e shkuar","after_2_weeks":"krijuar në 2 javët e shkuara"},"auto_track_topics":"Ndiq automatikisht temat ku futem","auto_track_options":{"never":"asnjëherë","immediately":"menjëherë","after_30_seconds":"pas 30 sekondash","after_1_minute":"pas 1 minute","after_2_minutes":"pas 2 minutash","after_3_minutes":"pas 3 minutash","after_4_minutes":"pas 4 minutash","after_5_minutes":"pas 5 minutash","after_10_minutes":"pas 10 minutash"},"invited":{"search":"shkruaj për të kërkuar ftesat...","title":"Ftesat","user":"Anëtari i ftuar","truncated":{"one":"Po afishohet ftesa e parë.","other":"Po afishohen {{count}} ftesat e para."},"redeemed":"Ftesa të Shlyera","redeemed_tab":"Shlyer","redeemed_tab_with_count":"Shlyer ({{count}})","redeemed_at":"Shlyer","pending":"Ftesat në pritje","pending_tab":"Në pritje","pending_tab_with_count":"Në pritje ({{count}})","topics_entered":"Temat e shikuara","posts_read_count":"Postimet e lexuara","expired":"Kjo ftesë ka skaduar.","rescind":"Hiq","rescinded":"Ftesa u hoq","reinvite":"Ridërgo ftesën","reinvite_all":"Ridërgo të gjitha ftesat","reinvited":"Ftesa u ri-dërgua","reinvited_all":"Tê gjitha ftesat u dërguan sërish!","time_read":"Koha e leximit","days_visited":"Ditë vizituar","account_age_days":"Jetëgjatësia e llogarisë (ditë)","create":"Dërgo një ftesë","generate_link":"Kopjo lidhjen e ftesës","bulk_invite":{"text":"Skedari për ftesat në grup","success":"Skedari u ngarkua, do njoftoheni me mesazh kur procesi të mbarojë. ","error":"Na vjen keq, skedari duhet të jete i formatit CSV."}},"password":{"title":"Fjalëkalimi","too_short":"Fjalëkalimi është shumë i shkurër.","common":"Ky fjalëkalim është shumë i përdorur.","same_as_username":"Fjalëkalimi është i njëjtë me emrin e përdoruesit.","same_as_email":"Fjalëkalimi është i njëjtë me adresën email.","ok":"Fjalëkalimi është i pranueshëm.","instructions":"të paktën %{count} shkronja"},"summary":{"title":"Përmbledhja","stats":"Statistikat","time_read":"koha e leximit","topic_count":{"one":"temë e krijuar","other":"tema të krijuara"},"post_count":{"one":"postim i krijuar","other":"postime të krijuara"},"days_visited":{"one":"ditë që viziton faqen","other":"ditë që viziton faqen"},"posts_read":{"one":"postim i lexuar","other":"postime të lexuar"},"bookmark_count":{"one":"temë e preferuar","other":"tema të preferuara"},"top_replies":"Përgjigjet popullore","no_replies":"Nuk ka ende përgjigje.","more_replies":"Më shumë përgjigje","top_topics":"Temat popullore","no_topics":"Nuk ka ende tema.","more_topics":"Më shumë tema","top_badges":"Stemat popullore","no_badges":"Ende asnjë stemë.","more_badges":"Më shumë stema","top_links":"Lidhjet Kryesore","no_links":"Nuk ka ende lidhje.","most_liked_by":"Pëlqyer më shumë nga","most_liked_users":"Më të pëlqyer","most_replied_to_users":"Me më shumë përgjigje","no_likes":"Nuk ka ende asnjë pëlqim.","topics":"Tema","replies":"Përgjigjet"},"ip_address":{"title":"Adresa IP e fundit"},"registration_ip_address":{"title":"Adresa IP e regjistrimit"},"avatar":{"title":"Foto e profilit","header_title":"profili, mesazhet, të preferuarat dhe preferencat"},"title":{"title":"Titulli","none":"(asnjë)"},"primary_group":{"title":"Grupi Parësor","none":"(asnjë)"},"filters":{"all":"Të gjitha"},"stream":{"posted_by":"Postuar nga","sent_by":"Dërguar nga","private_message":"mesazhi","the_topic":"tema"}},"loading":"Duke ngarkuar...","errors":{"prev_page":"duke u munduar të ngarkohet","reasons":{"network":"Gabim në rrjet","server":"Gabim në server","forbidden":"Ndalohet hyrja","unknown":"Gabim","not_found":"Faqja nuk u gjet"},"desc":{"network":"Ju lutemi, kontrolloni lidhjen me Internetin.","network_fixed":"Duket sikur Interneti u kthye.","server":"Kodi i gabimit: {{status}}","forbidden":"Nuk keni të drejtë të shikoni këtë.","not_found":"Ups, aplikimi tentoi të hapë një URL që nuk ekziston. ","unknown":"Diçka shkoi keq."},"buttons":{"back":"Kthehu mbrapa","again":"Provo përsëri","fixed":"Ngarko faqen"}},"modal":{"close":"mbylle"},"close":"Mbyll","assets_changed_confirm":"Faqja u azhornua. Doni t'a rifreskoni tani për versionin e fundit?","logout":"Ju jeni shkëputur!","refresh":"Rifresko","read_only_mode":{"enabled":"Faqja lejon vetëm leximet per momentin. Mund të vazhdoni të shfletoni, por përgjigjet, pëlqimet dhe veprime të tjera janë të çaktivizuara përkohësisht.","login_disabled":"Nuk mund të hyni në faqe sepse faqja është përkohësisht në formatin vetëm-lexim.","logout_disabled":"Nuk mund të shkëputeni nga faqja sepse faqja është përkohësisht në formatin vetëm-lexim."},"learn_more":"mëso më shumë...","all_time":"total","all_time_desc":"totali i temave të krijuara","year":"vit","year_desc":"temat e krijuara në 365 ditët e fundit","month":"muaj","month_desc":"temat e krijuara në 30 ditët e fundit","week":"javë","week_desc":"temat e krijuara në 7 ditët e fundit","day":"ditë","first_post":"Postimi i parë","mute":"Hesht","unmute":"Çaktivizo heshtjen","time_read":"Lexo","last_reply_lowercase":"përgjigja e fundit","replies_lowercase":{"one":"përgjigje","other":"përgjigje"},"signup_cta":{"sign_up":"Regjistrohu","hide_session":"Më rikujto nesër","hide_forever":"jo faleminderit","hidden_for_session":"OK, do t'ju rikujtojmë nesër. Sidoqoftë, ju mund të përdorni butonin 'Identifikohu' për të hapur një llogari. "},"summary":{"enabled_description":"Po lexoni një përmbledhje të kësaj teme: postimet më interesante sipas vlerësimit të komunitetit.","description":"Ka \u003cb\u003e{{replyCount}}\u003c/b\u003e përgjigje.","description_time":"Ka \u003cb\u003e{{replyCount}}\u003c/b\u003e përgjigje, do ju duhen rreth \u003cb\u003e{{readingTime}} minuta për t'i lexuar\u003c/b\u003e.","enable":"Përmblidhe këtë Temë","disable":"Shfaq të gjithë postimet"},"deleted_filter":{"enabled_description":"Kjo temë përmban postime të fshira, që tani janë fshehur.","disabled_description":"Postimet e fshira në këtë temë janë të dukshme.","enable":"Fshehi postimet e fshira","disable":"Shfaq postimet e fshira"},"private_message_info":{"title":"Mesazh","remove_allowed_user":"A doni vërtet të hiqni {{name}} nga ky mesazh?","remove_allowed_group":"Doni me të vërtetë të hiqni {{name}} nga ky mesazh? "},"email":"Email","username":"Emri i përdoruesit","last_seen":"Shikuar","created":"Krijuar","created_lowercase":"krijuar","trust_level":"Niveli i besimit","search_hint":"emri i anëtarit, email ose adresë IP","create_account":{"title":"Regjistrohuni","failed":"Diçka nuk funksionoi siç duhet, mbase kjo adresë emaili është e regjistruar në faqe. Provoni butonin e fjalëkalimit të humbur. "},"forgot_password":{"title":"Rivendos fjalëkalimin","action":"Kam harruar fjalëkalimin","invite":"Shkruani emrin e përdoruesit ose adresen email dhe ne do t'ju nisim një email për të rivendosur një fjalëkalim të ri.","reset":"Rivendos fjalëkalimin","complete_username":"Nëse në faqe ka një llogari me emër përdoruesi \u003cb\u003e%{username}\u003c/b\u003e ju do të merrni një email me udhëzimet sesi mund të rikuperoni fjalëkalimin.","complete_email":"Në në faqe ka një llogari me adresë emaili \u003cb\u003e%{email}\u003c/b\u003e ju do të merrni një email me udhëzimet mbi rivendosjen e fjalëkalimit.","complete_username_not_found":"Nuk ka llogari me emër përdoruesi \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nuk ka llogari për \u003cb\u003e%{email}\u003c/b\u003e","button_ok":"OK"},"email_login":{"complete_username_not_found":"Nuk ka llogari me emër përdoruesi \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nuk ka llogari për \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Vazhdo tek %{site_name}"},"login":{"title":"Identifikohu","username":"Anëtari","password":"Fjalëkalimi","email_placeholder":"email ose emri i përdoruesit","caps_lock_warning":"Caps Lock është aktive","error":"Gabim i panjohur","rate_limit":"Ju lutemi të prisni para se të provoni të identifikoheni përsëri. ","blank_username_or_password":"Ju lutem, shkruani adresën email ose emrin e përdoruesit dhe fjalëkalimin.","reset_password":"Rivendos fjalëkalimin","logging_in":"Duke u identifikuar...","or":"Ose","authenticating":"Duke u autorizuar...","awaiting_activation":"Llogaria juaj është në pritje të aktivizimit, përdorni butonin e fjalëkalimit të humbur që të merrni një email të ri me kodin e aktivizimit.","awaiting_approval":"Llogaria juaj nuk është aprovuar ende nga një admin. Do t'ju dërgojmë një email kur të aprovohet. ","requires_invite":"Na vjen keq, ky forum është vetëm për anëtarë të ftuar. ","not_activated":"Nuk mund të identifikoheni akoma. Ju kemi dërguar një email aktivizimi tek \u003cb\u003e{{sentTo}}\u003c/b\u003e. Ndiqni udhëzimet në atë email për të aktivizuar llogarinë tuaj. ","not_allowed_from_ip_address":"Nuk lejohet identifikimi nga kjo adresë IP.","admin_not_allowed_from_ip_address":"Nuk futesh dot si admin nga kjo adresë IP.","resend_activation_email":"Klikoni këtu për të dërguar sërish email-in e aktivizimit.","resend_title":"Dërgo përsëri emailin e aktivizimit","change_email":"Ndrysho adresën email","provide_new_email":"Vendosni një adresë të re email dhe do t'ju dërgojmë përsëri mesazhin e konfirmimit.","submit_new_email":"Ndrysho adresën email","sent_activation_email_again":"Ju dërguam një email aktivizimi të ri tek adresa {{currentEmail}}. Emaili mund të vonohet disa minuta, verifikoni edhe dosjen \"spam\". ","to_continue":"Ju lutemi, Identifikohuni","preferences":"Duhet të identifikoheni për të ndryshuar preferencat e profilit.","forgot":"Nuk i mbaj mend detajet e llogarisë","not_approved":"Llogaria juaj nuk është aprovuar ende. Do t'ju dërgojmë një email kur të aprovohet. ","google_oauth2":{"name":"Google","title":"me Google"},"twitter":{"name":"Twitter","title":"me Twitter"},"instagram":{"title":"me Instagram"},"facebook":{"title":"me Facebook"},"github":{"title":"me GitHub"}},"invites":{"accept_title":"Ftesë","welcome_to":"Mirë se vini tek %{site_name}!","invited_by":"Anëtari që ju ftoi: ","social_login_available":"Mund të identifikoheni edhe me një llogari tek Facebook me të njëjtën adresë emaili.","your_email":"Adresa email e llogarisë tuaj është \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Prano ftesën","success":"Llogaria juaj u krijua dhe ju tani mund të identifikoheni.","name_label":"Emri","password_label":"Vendos Fjalëkalim"},"password_reset":{"continue":"Vazhdo tek %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10"},"category_page_style":{"categories_only":"Vetëm kategoritë","categories_with_featured_topics":"Kategoritë dhe temat e zgjedhura","categories_and_latest_topics":"Kategoritë dhe temat e fundit"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"Duke ngarkuar..."},"date_time_picker":{"from":"Nga","to":"Për"},"emoji_picker":{"flags":"Sinjalizime"},"composer":{"emoji":"Emoji :)","more_emoji":"më shumë...","options":"Opsione","whisper":"pëshpëritje","unlist":"çlistuar","blockquote_text":"Citim","add_warning":"Ky është një paralajmërim zyrtar.","toggle_whisper":"Pëshpëritje?","toggle_unlisted":"Toggle Unlisted","posting_not_on_topic":"Cilës temë doni t'i përgjigjeni?","saved_local_draft_tip":"ruajtur lokalisht","similar_topics":"Tema juaj është e ngjashme me...","drafts_offline":"draftet offline","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"cannot_see_mention":{"private":"Ju përmendët {{username}} , por ky anëtar nuk do të njoftohet sepse nuk kanë akses në këtë mesazh privat. Do t'ju duhet t'a ftoni anëtarin në këtë mesazh. "},"error":{"title_missing":"Titulli është i nevojshëm","title_too_short":"Titulli duhet të ketë të paktën {{min} shkronja.","title_too_long":"Titulli nuk mund të ketë më shumë se {{max}} shkronja","post_length":"Postimi duhet të ketë të paktën {{min} shkronja.","category_missing":"Duhet të zgjidhni një kategori"},"save_edit":"Ruani modifikimet","reply_original":"Përgjigjuni temës origjinale","reply_here":"Përgjigju këtu","reply":"Përgjigju","cancel":"Anulo","create_topic":"Krijo temën","create_pm":"Mesazh","title":"Ose shtyp Ctrl+Enter","users_placeholder":"Shto një anëtar","title_placeholder":"Në një fjali të shkurtër shpjegoni për çfarë bën fjalë tema","title_or_link_placeholder":"Shkruani titullin ose ngjitni lidhjen këtu. ","edit_reason_placeholder":"pse jeni duke e redaktuar?","reply_placeholder":"Shkruani këtu. Mund të përdorni Markdown, BBCode, ose kod HTML për formatimin. Tërhiqni (drag and drop) ose kopjoni dhe ngjisni imazhet. ","view_new_post":"Shikoni postimin tuaj të ri.","saving":"Duke e ruajtur","saved":"U ruajt!","uploading":"Duke ngarkuar...","show_preview":"tregoni panelin e parashikimit \u0026raquo;","hide_preview":"\u0026laquo; fshiheni panelin e parashikimit","quote_post_title":"Citoni të gjithë postimin","bold_label":"B","bold_title":"Trashë","bold_text":"tekst i trashë","italic_label":"I","italic_title":"Theksuar","italic_text":"tekst i theksuar","link_title":"Lidhje","link_description":"shkruaj përshkrimin e lidhjes këtu","link_dialog_title":"Vendosni një lidhje","link_optional_text":"titull fakultativ","quote_title":"Citim","quote_text":"Citim","code_title":"Tekst i paraformatuar","code_text":"shkruani 4 hapësira (space) për të filluar tekstin e paraformatuar","paste_code_text":"shkruani ose ngjisni kodin këtu","upload_title":"Ngarko","upload_description":"shkruaj përshkrimin e skedarit të ngarkuar këtu","olist_title":"Listë e numëruar","ulist_title":"Listë me pika","list_item":"Element liste","help":"Ndihmë mbi Markdown","modal_ok":"OK","modal_cancel":"Anulo","cant_send_pm":"Na vjen keq, nuk mund t'i dërgoni mesazh privat anëtarit %{username}.","yourself_confirm":{"title":"Mos harruat të shtonit marrësit?","body":"Për momentin ky mesazh po ju dërgohet vetëm juve!"},"admin_options_title":"Rregullime opsionale të stafit për këtë temë","composer_actions":{"reply":"Përgjigju","edit":"Redakto","create_topic":{"label":"Temë e re"}},"details_title":"Përmbledhja"},"notifications":{"title":"njoftimet për përmendjet @emri, përgjigjet ndaj postime dhe temave, mesazhet, etj.","none":"Nuk i hapëm dot njoftimet.","empty":"Nuk u gjet asnjë njoftim. ","popup":{"mentioned":"{{username}} ju përmendi në \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} ju përmendi në \"{{topic}}\" - {{site_title}}","quoted":"{{username}} ju ka cituar në \"{{topic}}\" - {{site_title}}","replied":"{{username}} ju u përgjigj në \"{{topic}}\" - {{site_title}}","posted":"{{username}} postoi në \"{{topic}}\" - {{site_title}}","linked":"{{username}} vendosi një lidhje për postimin tuaj nga \"{{topic}}\" - {{site_title}}"},"titles":{"watching_first_post":"temë e re"}},"upload_selector":{"title":"Shto një imazh","title_with_attachments":"Shto një imazh ose një skedar","from_my_computer":"Nga kompiuteri im","from_the_web":"Nga Interneti","remote_tip":"lidhje tek imazhi","remote_tip_with_attachments":"lidhja për imazhin ose skedarin {{authorized_extensions}}","local_tip":"zgjidh imazhet nga aparati","local_tip_with_attachments":"zgjidh imazhet apo skedarët nga aparati {{authorized_extensions}}","hint":"(mundet edhe t'i tërhiqni e lëshoni mbi fushën përmbajtjes për t'i hedhur në faqe)","hint_for_supported_browsers":"ju mund të tërhiqni e lëshoni imazhet në editorin e tekstit","uploading":"Duke ngarkuar","select_file":"Zgjdhni një Skedar","default_image_alt_text":"imazh"},"search":{"sort_by":"Rendit sipas","relevance":"Rëndësia","latest_post":"Postimi i fundit","latest_topic":"Tema e fundit","most_viewed":"Më të shikuarat","most_liked":"Më të pëlqyer","select_all":"Zgjidhni Gjithçka","clear_all":"Pastro kriteret","too_short":"Fraza e kërkuar është shumë e shkurtër. ","title":"kërko në faqe","no_results":"Nuk u gjet asnjë rezultat.","no_more_results":"Nuk gjetëm rezultate të tjera. ","searching":"Duke kërkuar...","post_format":"#{{post_number}} nga {{username}}","search_google_button":"Google","search_google_title":"Kërko në këtë faqe","context":{"user":"Kërko postime nga @{{username}}","category":"Kërkoni kategorinë #{{category}}","topic":"Kërko tek kjo temë","private_messages":"Kërko mesazhet"},"advanced":{"title":"Kërkim i avancuar","posted_by":{"label":"Postuar nga"},"in_group":{"label":"Në grupin"},"with_badge":{"label":"Me stemën"}}},"hamburger_menu":"shko tek një kategori ose një listë e re temash","new_item":"e re","go_back":"kthehu mbrapa","not_logged_in_user":"faqja e përdoruesit me një përmbledhje të aktivitetit dhe preferencave","current_user":"shko tek profili yt","topics":{"new_messages_marker":"vizita e fundit","bulk":{"select_all":"Zgjidh të gjitha","clear_all":"Pastro kriteret","unlist_topics":"Hiq temat nga lista","reset_read":"Rivendos leximet","delete":"Fshi temat","dismiss":"Hiqe","dismiss_read":"Hiq të gjitha temat e palexuara","dismiss_button":"Hiqe...","dismiss_tooltip":"Hiq veç postimet e reja ose ndalo së ndjekuri temat","also_dismiss_topics":"Mos i gjurmo më këto tema që të mos afishohen më si të palexuara për mua","dismiss_new":"Hiq të Rejat","toggle":"toggle bulk selection of topics","actions":"Veprime në masë","close_topics":"Mbyll temat","archive_topics":"Arkivo temat","notification_level":"Njoftimet","choose_new_category":"Zgjidhni kategorinë e re për temat: ","selected":{"one":"Keni zgjedhur \u003cb\u003e%{count}\u003c/b\u003e temë.","other":"Keni zgjedhur \u003cb\u003e{{count}}\u003c/b\u003e tema."},"choose_new_tags":"Zgjidh etiketa të reja për këto tema:","changed_tags":"Etiketat e temave u ndryshuan. "},"none":{"unread":"Nuk keni tema të palexuara.","new":"Nuk ka tema të reja.","read":"Nuk keni lexuar asnjë temë deri tani.","posted":"Nuk keni shkruajtur tek asnjë temë deri tani.","latest":"Nuk ka tema të fundit. Oh sa keq.","bookmarks":"Nuk keni ende tema të preferuara. ","category":"Nuk ka tema në: {{category}}.","top":"Nuk ka tema popullore.","educate":{"new":"\u003cp\u003eTemat e reja shfaqen këtu.\u003c/p\u003e\u003cp\u003eAutomatikisht, temat cilësohen si të reja dhe kanë një shënim \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003ei ri\u003c/span\u003e nëse janë krijuar gjatë dy ditëve të fundit.\u003c/p\u003e\u003cp\u003eVizitoni \u003ca href=\"%{userPrefsUrl}\"\u003epreferencat\u003c/a\u003e për t'a ndryshuar këtë parametër.\u003c/p\u003e","unread":"\u003cp\u003eTemat e palexuara shfaqen këtu.\u003c/p\u003e\u003cp\u003eAutomatikisht, temat klasifikohen si të palexuara dhe kanë etiketa me numër \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e nëse ju:\u003c/p\u003e\u003cul\u003e\u003cli\u003ekrijuat temën\u003c/li\u003e\u003cli\u003eiu përgjigjët temës\u003c/li\u003e\u003cli\u003elexuat temën për më shumë se 4 minuta\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOse nëse keni zgjedhur të Gjurmoni ose Vëzhgoni temën duke klikuar në butonin përkatës në fund të çdo teme.\u003c/p\u003e\u003cp\u003eVizitoni \u003ca href=\"%{userPrefsUrl}\"\u003epreferencat tuaja\u003c/a\u003e për të bërë ndryshime.\u003c/p\u003e"}},"bottom":{"latest":"Nuk ka më tema të reja.","posted":"Nuk ka më tema të publikuara.","read":"Nuk ka më tema të lexuara.","new":"Nuk ka më tema të reja.","unread":"Nuk ka më tema të palexuara.","category":"Nuk ka më tema nga {{category}}.","top":"Nuk ka më tema popullore.","bookmarks":"Nuk ka më tema të preferuara."}},"topic":{"filter_to":{"one":"%{count} postim në temë","other":"{{count}} postime në temë"},"create":"Temë e re","create_long":"Hap një temë të re","private_message":"Fillo një mesazh","archive_message":{"help":"Zhvendoseni mesazhin në arkivën tuaj","title":"Arkivoni"},"move_to_inbox":{"title":"Lëviz në Inbox","help":"Riktheje mesazhin në inbox"},"defer":{"title":"Shty"},"list":"Temat","new":"temë e re","unread":"palexuar","new_topics":{"one":"%{count} temë e re","other":"{{count}} tema të reja"},"unread_topics":{"one":"%{count} temë e palexuar","other":"{{count}} tema të palexuara"},"title":"Tema","invalid_access":{"title":"Tema është private","description":"Na vjen keq, por nuk keni akses tek kjo temë. ","login_required":"Duhet të identifikoheni për të parë këtë temë. "},"server_error":{"title":"Temën nuk e hapëm dot","description":"Na vjen keq, nuk arritëm t'a ngarkojmuë këtë temë, problem serveri. Provoni përsëri më vonë. Nëse problemi vazhdon, ju lutemi të na njoftoni. "},"not_found":{"title":"Tema nuk u gjet","description":"Na vjen keq, nuk e gjetëm dot temën. Mund të jetë fshirë nga një moderator... "},"total_unread_posts":{"one":"ju keni %{count} postim të palexuar në këtë temë","other":"ju keni {{count}} postime të palexuara në këtë temë"},"unread_posts":{"one":"ju keni %{count} postim të vjetër të palexuar në këtë temë","other":"ju keni {{count}} postime të vjetra të palexuara në këtë temë"},"new_posts":{"one":"ka %{count} postim të ri në këtë temë që nga hera e fundit që ishit këtu","other":"ka {{count}} postime të reja në këtë temë që nga hera e fundit që ishit këtu"},"likes":{"one":"ka %{count} pëlqim në këtë temë","other":"ka {{count}} pëlqime në këtë temë"},"back_to_list":"Kthehu tek lista e temave","options":"Opsionet e temës","show_links":"trego lidhjet në këtë temë","toggle_information":"më shumë mbi temën","read_more_in_category":"Dëshironi të lexoni më shumë? Shfleto temat në {{catLink}} ose {{latestLink}}.","read_more":"Dëshironi të lexoni më shumë? {{catLink}} ose {{latestLink}}.","browse_all_categories":"Shfleto kategoritë","view_latest_topics":"shiko temat më të fundit","suggest_create_topic":"Pse nuk hapni një temë të re?","jump_reply_up":"hidhe tek përgjigja paraardhëse","jump_reply_down":"hidhu tek përgjigja pasardhëse","deleted":"Tema është fshirë","auto_close":{"error":"Ju lutem shkruani një vlerë të vlefshme.","based_on_last_post":"Mos e mbyll derisa postimi i fundit brenda temës të jetë të paktën kaq i vjetër. "},"status_update_notice":{"auto_close":"Kjo temë do të mbyllet automatikisht %{timeLeft}.","auto_close_based_on_last_post":"Kjo temë do të mbyllet %{duration} pas përgjigjes së fundit. "},"auto_close_title":"Rregullimet e Mbylljes Automatike","timeline":{"back":"Kthehu mbrapa","back_description":"Kthehu mbrapa tek postimi i fundit i palexuar","replies_short":"%{current} / %{total}"},"progress":{"title":"progresi i temës","go_top":"sipër","go_bottom":"poshtë","go":"shko","jump_bottom":"hidhu tek përgjigja e fundit","jump_bottom_with_number":"shko tek përgjigja %{post_number}","jump_prompt_or":"ose","total":"totali i postimeve","current":"postimi aktual"},"notifications":{"title":"ndryshoni sa shpesh njoftoheni mbi këtë temë","reasons":{"3_10":"Do të merrni njoftime sepse po vëzhgoni një etiketë në këtë temë. ","3_6":"Ju do të merrni njoftime sepse jeni duke vëzhguar këtë kategori. ","3_5":"Ju do të njoftoheni duke qënë se jeni duke gjurmuar këtë temë automatikisht. ","3_2":"Ju do të njoftoheni duke qënë se jeni duke vëzhguar këtë temë. ","3_1":"Ju do të njoftoheni duke qënë se ju jeni autori i kësaj teme. ","3":"Ju do të njoftoheni duke qënë se jeni duke vëzhguar këtë temë. ","2_8":"Ju do të shikoni numrin e përgjigjeve të reja sepse jeni duke gjurmuar këtë kategori. ","2_4":"Ju do të shikoni numrin e përgjigjeve të reja sepse ju postuat një përgjigje në këtë temë. ","2_2":"Ju do të shikoni numrin e përgjigjeve të reja sepse jeni duke gjurmuar këtë temë. ","2":"Ju do të shikoni numrin e përgjigjeve të reja sepse ju \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003elexuat këtë temë\u003c/a\u003e.","1_2":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. ","1":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. ","0_7":"Ju nuk do të merrni asnjë njoftim për temat në këtë kategori. ","0_2":"Ju nuk do të merrni asnjë njoftim për këtë temë. ","0":"Ju nuk do të merrni asnjë njoftim për këtë temë. "},"watching_pm":{"title":"Në vëzhgim","description":"Ju do të njoftoheni për çdo përgjigje të re në këtë mesazh, dhe numri i përgjigjeve të reja do të shfaqet. "},"watching":{"title":"Në vëzhgim","description":"Ju do të njoftoheni për çdo postim të ri në këtë temë, dhe numri i ri i përgjigjeve të reja do të tregohet."},"tracking_pm":{"title":"Në gjurmim","description":"Numri i përgjigjeve të reja do të afishohet për këtë mesazh. Do të njoftoheni vetëm nëse dikush ju përmend @emrin apo nëse dikush ju përgjigjet juve. "},"tracking":{"title":"Në gjurmim","description":"Numri i përgjigjeve të reja në këtë temë do të afishohet në listat e faqes. Do të njoftoheni nëse dikush ju përmend @emrin ose ju përgjigjet. "},"regular":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. "},"regular_pm":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. "},"muted_pm":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni kurrë mbi këtë mesazh. "},"muted":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni për asgjë mbi këtë temë, dhe tema nuk do të shfaqet në listën e temave më të fundit. "}},"actions":{"title":"Veprimet","recover":"Rivendos temën","delete":"Fshi temën","open":"Hap temën","close":"Mbyll temën","multi_select":"Përzgjidhni Postimet...","pin":"Ngjite temën...","unpin":"Çngjite temën...","unarchive":"Çarkivoje temën","archive":"Arkivoje temën","invisible":"Hiqeni nga Listat","visible":"Listojeni","reset_read":"Reset Read Data","make_public":"Bëje temën publike"},"feature":{"pin":"Ngjite temën","unpin":"Çngjite temën","pin_globally":"Ngjite temën globalisht","make_banner":"Temë banderolë","remove_banner":"Çaktivizo temën banderolë"},"reply":{"title":"Përgjigju","help":"fillo shkrimin e një përgjigjeje në këtë temë"},"clear_pin":{"title":"Clear pin","help":"Hiqeni statusin \"e ngjitur\" të kësaj teme që të mos afishohet më në majë të listës së temave"},"share":{"title":"Shpërndaje","help":"shpërndani një lidhje mbi temën"},"flag_topic":{"title":"Sinjalizo","help":"sinjalizo privatisht këtë temë ose dërgo një njoftim privat","success_message":"Sinjalizimi juaj i kësaj teme u krye me sukses. "},"feature_topic":{"title":"Temë në plan të parë","pin":"Shfaqe këtë temë në krye të kategorisë {{categoryLink}} deri më","confirm_pin":"Ju tashmë keni {{count}} tema të përzgjedhura. Shumë tema të përzgjedhura mund të bëhen barrë për përdorues të rinj dhe anonimë. A jeni i sigurtë që dëshironi ta përzgjidhni një temë tjetër në këtë kategori?","unpin":"Remove this topic from the top of the {{categoryLink}} category.","unpin_until":"Remove this topic from the top of the {{categoryLink}} category or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Përdoruesit mund ta çngjitin këtë temë veçan sipas dëshirës.","pin_validation":"Kërkohet data për ta ngjitur këtë temë në krye.","not_pinned":"Nuk ka tema të përzgjedhura në {{categoryLink}}.","already_pinned":{"one":"Temat kryesore të momentit në {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Temat kryesore të momentit në {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Shfaqe këtë temë në krye të listës së të gjitha temave deri më","confirm_pin_globally":"Ju tashmë keni {{count}} tema të përzgjedhura. Shumë tema të përzgjedhura mund të bëhen barrë për përdorues të rinj dhe anonimë. A jeni i sigurtë që dëshironi ta përzgjidhni një temë tjetër të gjithanëshme?","unpin_globally":"Remove this topic from the top of all topic lists.","unpin_globally_until":"Remove this topic from the top of all topic lists or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Përdoruesit mund ta çngjitin këtë temë veçan sipas dëshirës.","not_pinned_globally":"Nuk ka tema të përzgjedhura kudo.","already_pinned_globally":{"one":"Të gjitha temat kryesore të momentit: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Të gjitha temat kryesore të momentit: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Ktheje këtë temë në një temë parrullë që shfaqet në krye të të gjitha faqeve.","remove_banner":"Remove the banner that appears at the top of all pages.","banner_note":"Përdoruesit mund ta heqin temën parrullë duke e mbyllur atë. Vetëm një temë mund të kthehet në parrullë në një moment të caktuar.","no_banner_exists":"Nuk ka temë parrullë.","banner_exists":"Për momentin \u003cstrong class='badge badge-notification unread'\u003eka\u003c/strong\u003e një temë parrullë."},"inviting":"Inviting...","automatically_add_to_groups":"Kjo ftesë përfshin edhe akses për këto grupe:","invite_private":{"title":"Ftoje në këtë mesazh","email_or_username":"Emaili ose emri i përdoruesit të të ftuarit","email_or_username_placeholder":"adresa email ose emri i përdoruesit","action":"Fto","success":"Anëtari u ftua të marrë pjesë në këtë mesazh. ","error":"Sorry, there was an error inviting that user.","group_name":"emri i grupit"},"controls":"Veprimet e temës","invite_reply":{"title":"Fto","username_placeholder":"emri i përdoruesit","action":"Dërgoni ftesën","help":"fto të tjerë në këtë temë nëpërmjet emailit ose njoftimeve","to_forum":"Do të dërgojmë një email të shkurtër që do ta lejojë mikun tuaj të regjistrohet menjëherë duke klikuar një lidhje, pa kërkuar hyrjen në sistem.","sso_enabled":"Vendosni emrin e përdoruesit që dëshironi të ftoni në këtë temë","to_topic_blank":"Vendosni emrin e përdoruesit ose adresën email të personit që dëshironi të ftoni në këtë temë","to_topic_email":"Ju keni shtuar një adresë email. Ne do t'i dërgojmë një ftesë në email që do ta lejojë mikun tuaj t'i përgjigjet menjëherë kësaj teme.","to_topic_username":"Ju shtuat një emër përdoruesi. Ne do t'i dërgojmë një njoftim me një lidhje duke i ftuar ata në këtë temë.","to_username":"Vendosni emrin e përdoruesit që dëshironi të ftoni. Sistemi do i dërgojë një njoftim me një lidhje drejt kësaj teme. ","email_placeholder":"emri@adresa.com","success_email":"Sistemi dërgoi një ftesë për \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Do t'ju njoftojmë kur ftesa të jetë pranuar. Shikoni edhe faqen Ftesat nën profilin tuaj të anëtarit për të parë statusin e ftesave. ","success_username":"Ky anëtar u ftua të marrë pjesë në këtë temë. ","error":"Nuk e ftuam dot këtë person. A ka mundësi që të jetë ftuar më parë?"},"login_reply":"Identifikohu për t'u Përgjigjur","filters":{"n_posts":{"one":"%{count} postim","other":"{{count}} postime"},"cancel":"Hiq filtrin"},"split_topic":{"title":"Ktheje në një temë të re","action":"ktheje në një temë të re","radio_label":"Temë e re","error":"Pati një gabim gjatë transfertës drejt një teme të re.","instructions":{"one":"Jeni duke krijuar një temë të re dhe duke e populluar atë me postimin që keni përzgjedhur.","other":"Jeni duke krijuar një temë të re dhe duke e populluar atë me \u003cb\u003e{{count}}\u003c/b\u003e postimet që keni përzgjedhur."}},"merge_topic":{"title":"Transfero tek një Temë tjetër","action":"transfero tek një temë tjetër","error":"Pati një gabim gjatë transfertës drejt një teme tjetër.","instructions":{"one":"Ju lutem zgjidhni një temë ku do dëshironit ta zhvendosni këtë postim.","other":"Ju lutem, zgjidhni një temë ku do të dëshironit të zhvendosni këto \u003cb\u003e{{count}}\u003c/b\u003e postime."}},"move_to_new_message":{"radio_label":"Mesazh i ri"},"merge_posts":{"title":"Bashkoni Postimet e Përzgjedhura","action":"bashkoni postimet e përzgjedhura","error":"Ndodhi një gabim ndërsa po bashkoheshin postimet e përzgjedhura."},"change_owner":{"action":"ndrysho zotëruesin","error":"Pati një gabim gjatë ndryshimit të autorit të postimeve.","placeholder":"emri i përdoruesit të autorit"},"change_timestamp":{"action":"ndrysho datën","invalid_timestamp":"Data nuk mund të jetë në të ardhmen.","error":"Hasëm në një gabim gjatë ndryshimit të datës së temës. ","instructions":"Ju lutem zgjidhni një datë postimi për temën. Postimet në temë do të përditësohen për të patur të njëjtën diferencë kohore."},"multi_select":{"select":"zgjidh","selected":"të zgjedhura ({{count}})","select_post":{"label":"zgjidh"},"select_replies":{"label":"select +replies"},"delete":"fshij të përzgjedhurat","cancel":"anulo përzgjedhjen","select_all":"përzgjidhi të gjitha","deselect_all":"pastro zgjedhjen","description":{"one":"Keni përzgjedhur \u003cb\u003e%{count}\u003c/b\u003e postim.","other":"Keni përzgjedhur \u003cb\u003e{{count}}\u003c/b\u003e postime."}}},"post":{"edit_reason":"Arsyeja:","post_number":"postimi {{number}}","last_edited_on":"redaktimi i fundit u krye më","reply_as_new_topic":"Përgjigju në një temë të re të ndërlidhur","continue_discussion":"Vazhdim i diskutimit nga tema {{postLink}}:","follow_quote":"shko tek tema e cituar","show_full":"Shfaq postimin e plotë","deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","other":"(postim i tërhequr nga autori, do të fshihet automatikisht në %{count} orë nëse nuk sinjalizohet)"},"expand_collapse":"zgjero/shkurto","gap":{"one":"shiko %{count} përgjigje të fshehur","other":"shiko {{count}} përgjigje të fshehura"},"unread":"Postimi është i palexuar","has_replies":{"one":"{{count}} Përgjigje","other":"{{count}} përgjigje"},"has_likes_title":{"one":"%{count} person pëlqeu këtë postim","other":"{{count}} vetë pëlqyen këtë postim"},"has_likes_title_only_you":"ju pëlqeni këtë postim","has_likes_title_you":{"one":"ju dhe %{count} person tjetër pëlqyet këtë postim","other":"ju dhe {{count}} të tjerë pëlqyen këtë postim"},"errors":{"create":"Na vjen keq, por ndodhi një gabim gjatë hapjes së temës. Provojeni përsëri.","edit":"Na vjen keq, ndodhi një gabim gjatë redaktimit të temës. Provojeni përsëri.","upload":"Na vjen keq, pati një gabim gjatë ngarkimit të skedarit. Provo përsëri. ","too_many_uploads":"Na vjen keq, por duhet t'i ngarkoni skedarët një nga një.","image_upload_not_allowed_for_new_user":"Na vjen keq, anëtarët e rinj nuk mund të ngarkojnë skedarë. ","attachment_upload_not_allowed_for_new_user":"Na vjen keq, anëtarët e rinj nuk mund të ngarkojnë skedarë. ","attachment_download_requires_login":"Na vjen keq, duhet të identifikoheni për të shkarkuar një dokument. "},"abandon_edit":{"no_value":"Jo, mbaji"},"abandon":{"confirm":"A jeni të sigurtë se do të braktisni postimin?","no_value":"Jo, mbaji","yes_value":"Po, braktise"},"via_email":"ky postim u dërgua me email","via_auto_generated_email":"ky postim u krijua nga një email automatik","whisper":"ky postim është një pëshpëritje private për moderatorët","wiki":{"about":"kjo temë është wiki"},"archetypes":{"save":"Ruaj opsionet"},"few_likes_left":"Ju falenderojmë! Ju kanë ngelur edhe disa pëlqime për sot.","controls":{"reply":"shkruaj një përgjigje tek ky diskutim","like":"pëlqeje postimin","has_liked":"ju pëlqeni këtë postim","undo_like":"anulo pëlqimin","edit":"redakto këtë postim","edit_action":"Redakto","edit_anonymous":"Na vjen keq, ju duhet të jeni të identifikuar për të redaktuar këtë postim. ","flag":"sinjalizojeni privatisht këtë postim për të tërhequr vëmendjen e adminëve","delete":"fshini këtë postim","undelete":"anuloni fshirjen e postimit","share":"shpërndani një link tek ky postim","more":"Më shumë","delete_replies":{"just_the_post":"Jo, vetëm këtë postim"},"admin":"veprimet administrative mbi postimin","wiki":"Bëje Wiki","unwiki":"Hiqe Wiki","convert_to_moderator":"Shto ngjyrë stafi","revert_to_regular":"Hiq ngjyrën e stafit","rebake":"Rindërtoni HTML","unhide":"Çfshi","change_owner":"Ndrysho zotëruesin","grant_badge":"Dhuroni Stemë","delete_topic":"fshi temën"},"actions":{"flag":"Sinjalizoni","undo":{"off_topic":"Anulo sinjalizimin","spam":"Anulo sinjalizimin","inappropriate":"Anulo sinjalizimin","bookmark":"Hiqe nga të preferuarat","like":"Anulo pëlqimin"},"people":{"off_topic":"sinjalizoi këtë postim si jashtë teme","spam":"sinjalizoi këtë postim si spam","inappropriate":"sinjalizoi këtë postim si të papërshtatshëm","notify_moderators":"njoftoi moderatorët","notify_user":"dërgoi një mesazh","bookmark":"e shtoi këtë tek të preferuarat"},"by_you":{"off_topic":"Ti sinjalizove këtë postim si jashtë teme","spam":"Ti sinjalizove këtë postim si spam","inappropriate":"Ti sinjalizove këtë postim si të papërshtatshëm","notify_moderators":"Ti sinjalizove këtë postim për moderim","notify_user":"Ju i dërguat një mesazh këtij përdoruesi","bookmark":"E ruajte këtë temë tek të preferuarat e tua","like":"Ju e pëlqyet këtë"}},"revisions":{"controls":{"first":"Revizioni i parë","previous":"Revizioni i shkuar","next":"Revizioni i ardhshëm","last":"Revizioni i fundit","hide":"Fshihe revizionin","show":"Trego revizionin","revert":"Rikthe këtë version"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline","button":"HTML"},"side_by_side":{"title":"Show the rendered output diffs side-by-side","button":"HTML"},"side_by_side_markdown":{"title":"Show the raw source diffs side-by-side"}}},"raw_email":{"displays":{"text_part":{"button":"Tekst"},"html_part":{"button":"HTML"}}},"bookmarks":{"created":"Krijuar","name":"Emri"}},"category":{"can":"mund\u0026hellip; ","none":"(pa kategori)","all":"Të gjitha kategoritë","edit":"Redakto","view":"Shiko temat në kategorinë","general":"Karakteristika të përgjithshme","settings":"Rregullimet","topic_template":"Shabllon i Temës","tags":"Etiketat","tags_placeholder":"(Opsionale) lista e etiketave të lejuara","tag_groups_placeholder":"(Opsionale) lista e grupeve të etiketave","delete":"Fshini kategorinë","create":"Krijo kategorinë e re","create_long":"Krijo një kategori të re","save":"Ruaj kategorinë","slug":"Slug i kategorisë","slug_placeholder":"(Optional) dashed-words for url","creation_error":"Pati një gabim gjatë krijimit të kategorisë","save_error":"Pati një gabim gjatë ruajtjes së kategorisë","name":"Emri i kategorisë","description":"Përshkrimi","topic":"category topic","logo":"Logo e kategorisë","background_image":"Imazhi i sfondit për kategorinë","badge_colors":"Ngjyrat e stemës","background_color":" Ngjyra e sfondit","foreground_color":"Foreground color","name_placeholder":"Maksimumi një ose dy fjalë","color_placeholder":"Çdo ngjyrë web","delete_confirm":"Jeni i sigurtë që dëshironi ta fshini këtë kategori?","delete_error":"Pati një gabim gjatë fshirjes së kategorisë.","list":"Shfaq kategoritë","no_description":"Shto një përshkrim për këtë kategori.","change_in_category_topic":"Redakto përshkrimin","already_used":"Kjo ngjyrë është përdorur nga një kategori tjetër","security":"Siguria","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","images":"Imazhet","email_in":"Custom incoming email address:","email_in_allow_strangers":"Prano emaila nga anëtarë anonimë pa llogari në faqe","email_in_disabled":"Postimi i temave të reja me email është çaktivizuar në Rregullimet e faqes. Për të aktivizuar postimet e temave të reja me email,","email_in_disabled_click":"aktivizo rregullimin \"email in\".","allow_badges_label":"Lejo të jepen stemat në këtë kategori","edit_permissions":"Ndryshoni autorizimet","review_group_name":"emri i grupit","this_year":"këtë vit","default_position":"Default Position","position_disabled":"Kategoritue do të renditen sipas aktivitetit. Për të kontrolluar renditjen e kategorive nëpër lista, ","position_disabled_click":"aktivizoni rregullimin \"pozicione fikse për kategoritë\".","parent":"Kategoria prind","notifications":{"watching":{"title":"Në vëzhgim"},"watching_first_post":{"title":"Postimi i parë nën vëzhgim"},"tracking":{"title":"Në gjurmim"},"regular":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. "},"muted":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni për asgjë nga temat e reja të këtyre kategorive, dhe këto tema nuk do të afishohen në faqen \"Më të fundit\" për ju. "}},"search_priority":{"options":{"normal":"Normal"}},"sort_options":{"likes":"Pëlqime","views":"Shikimet","posts":"Postime","activity":"Aktiviteti","category":"Kategori","created":"Krijuar"},"settings_sections":{"general":"Karakteristika të përgjithshme","email":"Email"}},"flagging":{"title":"Faleminderit për ndihmën që i jepni këtij komuniteti!","action":"Sinjalizo postimin","take_action":"Vepro","notify_action":"Mesazh","official_warning":"Paralajmërim zyrtar","delete_spammer":"Elimino Spammer","yes_delete_spammer":"Po, Elimino Spammer","ip_address_missing":"(N/A)","hidden_email_address":"(fshehur)","submit_tooltip":"Dërgoni sinjalizimin privatisht","take_action_tooltip":"Kaloni direkt tek pragu i sinjalizimeve (dmth, mos prisni për sinjalizime të tjera nga komuniteti)","cant":"Na vjen keq, nuk mund të sinjalizoni këtë postim tani. ","notify_staff":"Njoftoni stafin privatisht","formatted_name":{"off_topic":"Është jashtë teme","inappropriate":"Është e papërshtatshme","spam":"Është Spam"},"custom_placeholder_notify_user":"Jini specifikë, konstruktiv dhe gjithmonë të sjellshëm.","custom_placeholder_notify_moderators":"Na thoni specifikisht se çfarë ju shqetëson dhe na jepni lidhje dhe shembuj konkretë brenda mundësive. ","custom_message":{"at_least":{"one":"futni së paku %{count} gërmë","other":"futni së paku {{count}} gërma"},"more":{"one":"edhe %{count} për të vazhduar...","other":"edhe {{count}} për të vazhduar..."},"left":{"one":"edhe %{count} gërmë","other":"edhe {{count}} gërma"}}},"flagging_topic":{"title":"Faleminderit për ndihmën që i jepni këtij komuniteti!","action":"Raporto Temën","notify_action":"Message"},"topic_map":{"title":"Përmbledhja e Temës","participants_title":"Postues të Shpeshtë","links_title":"Lidhje Aktive","links_shown":"trego më shumë lidhje...","clicks":{"one":"%{count} klik","other":"%{count} klikime"}},"post_links":{"about":"trego më shumë lidhje për këtë postim","title":{"one":"edhe %{count}","other":"edhe %{count}"}},"topic_statuses":{"warning":{"help":"Ky është një paralajmërim zyrtar."},"bookmarked":{"help":"E ruajte këtë temë tek të preferuarat e tua"},"locked":{"help":"Kjo temë është mbyllur; nuk pranon më përgjigje"},"archived":{"help":"Kjo temë është arkivuar; nuk mund të bëhen ndryshime "},"locked_and_archived":{"help":"Kjo temë është mbyllur dhe arkivuar; nuk pranohen përgjigje apo ndryshime"},"unpinned":{"title":"Jo e përzgjedhur","help":"Kjo temë është e çngjitur për ju; do të paraqitet në renditje normale"},"pinned_globally":{"title":"E përzgjedhur Kudo","help":"Kjo temë është e ngjitur globalisht; do të paraqitet në majë të postimeve të reja dhe të kategorisë përkatëse"},"pinned":{"title":"E përzgjedhur","help":"Kjo temë është e ngjitur për ju; do të paraqitet në majë të kategorisë përkatëse"},"unlisted":{"help":"Kjo temë nuk është e listuar, pra nuk do të paraqitet nue listat e temave të faqes dhe mund të shikohet vetëm me lidhje direkte"}},"posts":"Postime","posts_long":"ka {{number}} postime në temë","original_post":"Postimi Origjinal","views":"Shikimet","views_lowercase":{"one":"shikim","other":"shikime"},"replies":"Përgjigjet","activity":"Aktiviteti","likes":"Pëlqimet","likes_lowercase":{"one":"pëlqim","other":"pëlqime"},"likes_long":"ka {{number}} pëlqime në këtë temë","users":"Përdoruesit","users_lowercase":{"one":"përdorues","other":"përdorues"},"category_title":"Kategoria","history":"Historia","changed_by":"nga {{author}}","raw_email":{"not_available":"Not available!"},"categories_list":"Lista Kategorive","filters":{"with_topics":"Temat nga %{filter}","with_category":"Temat nga: %{filter}, %{category}","latest":{"title":"Më të fundit","title_with_count":{"one":"Më të fundit (%{count}) ","other":"Më të fundit ({{count}}) "},"help":"temat me postime të fundit"},"read":{"title":"Lexo","help":"temat që keni lexuar, radhitur sipas datës më të fundit të leximit"},"categories":{"title":"Kategoritë","title_in":"Kategoria - {{categoryName}}","help":"të gjitha temat të grupuara sipas kategorisë"},"unread":{"title":"Të palexuara","title_with_count":{"one":"Të palexuara (%{count})","other":"Të palexuara ({{count}})"},"help":"topics you are currently watching or tracking with unread posts","lower_title_with_count":{"one":"%{count} e palexuar","other":"{{count}} të palexuara"}},"new":{"lower_title_with_count":{"one":"%{count} e re","other":"{{count}} të reja"},"lower_title":"e re","title":"Të reja","title_with_count":{"one":"Të reja (%{count})","other":"Të reja ({{count}})"},"help":"temat e krijuar gjatë ditëve të fundit"},"posted":{"title":"Postimet e mia","help":"temat ku keni dërguar pêrgjigje"},"bookmarks":{"title":"Të preferuarat","help":"tema që keni preferuar"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"temat e fundit në kategorinë {{categoryName}}"},"top":{"title":"Popullore","help":"temat më aktive të vitit, muajit, javës apo ditës së shkuar","all":{"title":"Gjithë Kohës"},"yearly":{"title":"Vjetore"},"quarterly":{"title":"Tremujorsh"},"monthly":{"title":"Mujore"},"weekly":{"title":"Javore"},"daily":{"title":"Ditore"},"all_time":"Gjithë kohës","this_year":"Këtë vit","this_quarter":"Këtë tremujor","this_month":"Këtë muaj","this_week":"Këtë javë","today":"Sot","other_periods":"shiko më populloret"}},"permission_types":{"full":"Krijo / Përgjigju / Shiko","create_post":"Përgjigju / Shiko","readonly":"Shiko"},"lightbox":{"download":"shkarko"},"keyboard_shortcuts_help":{"title":"Shkurtimet e tastierës ","jump_to":{"title":"Kalo tek","home":"%{shortcut} Faqja e parë","latest":"%{shortcut} Më të fundit","new":"%{shortcut} Të rejat","unread":"%{shortcut} Të palexuarat","categories":"%{shortcut} Kategoritë","top":"%{shortcut} Populloret","bookmarks":"%{shortcut} Të preferuarat","profile":"%{shortcut} Profili","messages":"%{shortcut} Mesazhet"},"navigation":{"title":"Shfletimi","jump":"%{shortcut} Shko tek postimi #","back":"%{shortcut} Mbrapa","up_down":"%{shortcut} Move selection \u0026uarr; \u0026darr;","open":"%{shortcut} Lexo temën e zgjedhur","next_prev":"%{shortcut} Seksioni i ardhshëm/mëparshëm"},"application":{"title":"Aplikimi","create":"%{shortcut} Hap një temë të re","notifications":"%{shortcut} Hap njoftimet","hamburger_menu":"%{shortcut} Hap menunë hamburger","user_profile_menu":"%{shortcut} Hap menunë e përdoruesit","show_incoming_updated_topics":"%{shortcut} Shiko temat e përditësuara","help":"%{shortcut} Trego shkurtimet e tastierës","dismiss_new_posts":"%{shortcut} Hiq Të Rejat/Postimet","dismiss_topics":"%{shortcut} Hiq temat","log_out":"%{shortcut} Shkëputu"},"actions":{"title":"Veprimet","bookmark_topic":"%{shortcut} Shto/hiq temën nga të preferuarat","pin_unpin_topic":"%{shortcut} Ngjit/çngjit temën","share_topic":"%{shortcut} Shpërndaje temën","share_post":"%{shortcut} Shpërnda postimin","reply_as_new_topic":"%{shortcut} Përgjigju në një temë të lidhur","reply_topic":"%{shortcut} Përgjigju temës","reply_post":"%{shortcut} Përgjigju postimit","quote_post":"%{shortcut} Cito postimin","like":"%{shortcut} Pëlqeje postimin","flag":"%{shortcut} Sinjalizo postimin","bookmark":"%{shortcut} Shto postimin tek të preferuarat","edit":"%{shortcut} Redakto postimin","delete":"%{shortcut} Fshi postimin","mark_muted":"%{shortcut} Bëje temë të heshtur","mark_regular":"%{shortcut} Shënoje temën si të zakonshme","mark_tracking":"%{shortcut} Ndiqe temën","mark_watching":"%{shortcut} Vëzhgoje temën","print":"%{shortcut} Printo temën"}},"badges":{"earned_n_times":{"one":"Kjo stemë është fituar %{count} herë","other":"Kjo stemë është fituar %{count} herë"},"granted_on":"Atribuar më %{date}","others_count":"Të tjerë me këtë stemë (%{count})","title":"Stemat","allow_title":"Mund t'a përdorësh këtë stemë si titull","multiple_grant":"Kjo stemë mund të fitohet disa herë","badge_count":{"one":"%{count} stemë","other":"%{count} stema"},"more_badges":{"one":"+%{count} tjetër","other":"+%{count} të tjera"},"granted":{"one":"%{count} e akorduar","other":"%{count} të akorduara"},"select_badge_for_title":"Zgjidhni një stemë për ta përdorur si titullin tuaj","none":"(asnjë)","badge_grouping":{"getting_started":{"name":"Fillestar"},"community":{"name":"Komuniteti"},"trust_level":{"name":"Niveli i besimit"},"other":{"name":"Tjetër"},"posting":{"name":"Postimet"}}},"tagging":{"all_tags":"Të gjitha etiketat","selector_all_tags":"të gjitha etiketat","selector_no_tags":"asnjë etiketë","changed":"etiketat e ndryshuara:","tags":"Etiketat","add_synonyms":"Shto","delete_tag":"Fshi etiketën","rename_tag":"Riemëro etiketën","rename_instructions":"Zgjidhni një emër të ri për këtë etiketë","sort_by":"Rendit sipas:","sort_by_count":"numri","sort_by_name":"emër","cancel_delete_unused":"Anulo","filters":{"without_category":"%{filter} %{tag} temat","with_category":"%{filter} %{tag} temat në %{category}","untagged_without_category":"%{filter} temat pa etiketë","untagged_with_category":"%{filter} temat pa etiketë në %{category}"},"notifications":{"watching":{"title":"Në vëzhgim"},"watching_first_post":{"title":"Postimi i parë nën vëzhgim"},"tracking":{"title":"Në gjurmim"},"regular":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose i përgjigjet postimeve tuaja. "},"muted":{"title":"Të heshtur"}},"groups":{"title":"Grupe etiketash","about":"Organizoni etiketat nëpër grupe për të thjeshtuar mirëmbajtjen.","new":"Grup i ri","tags_label":"Etiketat në këtë grup:","parent_tag_label":"Etiketa prind:","parent_tag_placeholder":"Fakultative","parent_tag_description":"Etiketat nga ky grup mund të përdoren vetëm në etiketa prind është prezente.","one_per_topic_label":"Vetëm 1 etiketë për temë nga ky grup","new_name":"Grup i ri etiketash","save":"Ruaj","delete":"Fshije","confirm_delete":"Jeni të sigurtë që doni të fshini këtë grup etiketash?"},"topics":{"none":{"unread":"Nuk keni tema të palexuara.","new":"Nuk ka tema të reja.","read":"Nuk keni lexuar asnjë temë deri tani.","posted":"Nuk keni shkruajtur tek asnjë temë deri tani.","latest":"Nuk ka tema të reja.","bookmarks":"Nuk keni ende tema të preferuara. ","top":"Nuk ka tema popullore."},"bottom":{"latest":"Nuk ka më tema të reja.","posted":"Nuk ka më tema të publikuara.","read":"Nuk ka më tema të lexuara.","new":"Nuk ka më tema të reja.","unread":"Nuk ka më tema të palexuara.","top":"Nuk ka më tema popullore.","bookmarks":"Nuk ka më tema të preferuara."}}},"invite":{"custom_message_placeholder":"Vendosni mesazhin","custom_message_template_forum":"Hej, hajde bashkoju këtij forumi!","custom_message_template_topic":"Hej, besoj se do të të pelqejë kjo temë!"},"poll":{"voters":{"one":"votues","other":"votuesit"},"total_votes":{"one":"total vota","other":"totali votave"},"average_rating":"Vlerësimi mesatar: \u003cstrong\u003e%{average}\u003c/strong\u003e.","multiple":{"help":{"at_least_min_options":{"one":"Zgjidhni të paktën \u003cstrong\u003e%{count}\u003c/strong\u003e alternativë","other":"Zgjidhni të paktën \u003cstrong\u003e%{count}\u003c/strong\u003e alternativa"},"up_to_max_options":{"one":"Zgjidhni deri në \u003cstrong\u003e%{count}\u003c/strong\u003e alternativë","other":"Zgjidhni deri në \u003cstrong\u003e%{count}\u003c/strong\u003e alternativa"},"x_options":{"one":"Zgjidhni \u003cstrong\u003e%{count}\u003c/strong\u003e alternativë","other":"Zgjidhni \u003cstrong\u003e%{count}\u003c/strong\u003e alternativa"},"between_min_and_max_options":"Zgjidhni midis \u003cstrong\u003e%{min}\u003c/strong\u003e dhe \u003cstrong\u003e%{max}\u003c/strong\u003e alternativash"}},"cast-votes":{"title":"Jepni votën tuaj","label":"Voto Tani"},"show-results":{"title":"Display the poll results","label":"Shfaq rezultatet"},"hide-results":{"title":"Back to your votes"},"export-results":{"label":"Eksporto"},"open":{"title":"Fillo një Sondazh","label":"Fillo","confirm":"Jeni të sigurt për të hapur këtë sondazh?"},"close":{"title":"Mbyll sondazhin","label":"Mbyll","confirm":"Jeni të sigurt për të mbyllur këtë sondazh?"},"error_while_toggling_status":"Ndjesë, u has në një gabim kur u ndryshua gjendja e këtij sondazhi.","error_while_casting_votes":"Ndjesë, u has në një gabim duke mbledhur votat tuaja.","error_while_fetching_voters":"Ndjesë, u has në një gabim duke shfaqur votuesit.","ui_builder":{"title":"Krijo Sondazh","insert":"Shto Sondazh","poll_type":{"label":"Lloji","regular":"Pa Alternativa","multiple":"Me Alternativa","number":"Vlerësim Numrash"},"poll_result":{"label":"Results"},"poll_config":{"max":"Maksimumi","min":"Minimumi","step":"Hapi"},"poll_public":{"label":"Shfaq votuesit"},"poll_options":{"label":"Shto një alternativë për çdo rresht"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Nisni udhëzuesin e ri të përdorimit për të gjithë anëtarët","welcome_message":"Dërgojini të gjithë anëtarëve të rinj një mesazh mirëseardhjeje me një udhëzues nga t'ia nisi shpejt"}},"discourse_local_dates":{"create":{"form":{"time_title":"Koha"}}},"voting":{"vote_title":"Voto"},"docker":{"upgrade":"Platforma juaj Discourse ka përtëritje.","perform_upgrade":"Kliko këtu për ta përtëritur."}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm","tiny":{"less_than_x_minutes":{"other":"\u003c %{count} 分钟"},"x_months":{"other":"%{count} 个月"}},"medium_with_ago":{"x_months":{"other":"%{count} 个月前"},"x_years":{"other":"%{count} 年前"}},"placeholder":"日期"},"share":{"topic_html":"主题: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","twitter":"分享此链接至 Twitter","facebook":"分享此链接至 Facebook","email":"通过电子邮件分享此链接"},"action_codes":{"private_topic":"于%{when}将该主题转换为私信","autobumped":"于%{when}自动顶帖","banner":{"enabled":"于%{when}将此设置为横幅。用户关闭横幅前，横幅将显示在每一页的顶部。","disabled":"于%{when}移除了该横幅。横幅将不再显示在每一页的顶部。"},"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","bootstrap_mode_enabled":"为方便新站点的冷启动，现正处于初始化模式中。所有新用户将被授予信任等级 1，并为他们启用每日邮件摘要。初始化模式会在用户数超过%{min_users}个时关闭。","bootstrap_mode_disabled":"初始化模式将会在24小时内关闭。","themes":{"broken_theme_alert":"因为主题或组件%{theme}有错误，你的网站可能无法正常运行。 在%{path}禁用它。"},"s3":{"regions":{"ca_central_1":"加拿大（中部）","cn_northwest_1":"中国（宁夏）","eu_north_1":"欧洲（斯德哥尔摩）","eu_west_3":"欧洲（巴黎）","sa_east_1":"南美（圣保罗）","us_east_2":"美国东部（俄亥俄州）","us_gov_east_1":"AWS 政府云（US-East）","us_gov_west_1":"AWS 政府云（US-West）"}},"submit":"提交","go_ahead":"继续","rules":"规则","conduct":"行为准则","every_month":"每月","every_six_months":"每6个月","related_messages":{"title":"相关消息","see_all":"查看来自 @%{username} 的\u003ca href=\"%{path}\"\u003e所有消息\u003c/a\u003e ..."},"about":{"stat":{"last_7_days":"过去7天","last_30_days":"过去30天"}},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"not_bookmarked":"收藏此帖","created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","confirm_clear":"你确定要清空这个主题中的所有收藏？","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","later_today":"今天的某个时候","next_business_day":"下一个工作日","tomorrow":"明天","next_week":"下个星期","later_this_week":"这周的某个时候","start_of_next_business_week":"下周一","next_month":"下个月","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"drafts":{"resume":"复位","new_topic":"新主题草稿","new_private_message":"新私信草稿","topic_reply":"草稿回复","abandon":{"confirm":"你已在此主题中打开了另一个草稿。 你确定要舍弃它吗？"}},"topic_count_latest":{"other":"有 {{count}} 个更新或新主题"},"topic_count_unread":{"other":"有 {{count}} 个未读主题"},"topic_count_new":{"other":"有 {{count}} 个新主题"},"uploading_filename":"上传中：{{filename}}...","clipboard":"剪贴板","pasting":"粘贴中…","continue":"继续","pwa":{"install_banner":"你想要\u003ca href\u003e安装%{title}在此设备上吗？\u003c/a\u003e"},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"none_found":"无符合的结果","title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"order_by":"排序依据","explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","formula":"公式","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"claim_help":{"optional":"你可以认领此条目以避免被他人审核。","required":"在你审核之前你必须认领此条目。","claimed_by_you":"你已认领此条目现在可以审核了。","claimed_by_other":"此条目仅可被\u003cb\u003e{{username}}\u003c/b\u003e审核。"},"claim":{"title":"认领该主题"},"unclaim":{"help":"移除该认领"},"awaiting_approval":"需要审核","settings":{"saved":"已保存！","priorities":{"title":"需审核优先级"}},"moderation_history":"管理日志","view_all":"查看全部","grouped_by_topic":"依据主题分组","none":"没有项目需要审核","view_pending":"查看待审核","topic_has_pending":{"other":"该主题中有 \u003cb\u003e{{count}}\u003c/b\u003e 个帖等待审核中"},"title":"审核","filtered_topic":"您正在选择性地查看这一主题中的可审核内容。","show_all_topics":"显示所有主题","deleted_post":"(已删除的帖子)","deleted_user":"(已删除的用户)","user":{"bio":"简介","website":"网站","fields":"字段"},"user_percentage":{"summary":{"other":"{{agreed}}，{{disagreed}}，{{ignored}}（共{{count}}个标记）"},"agreed":{"other":"{{count}}%同意"},"disagreed":{"other":"{{count}}%不同意"},"ignored":{"other":"{{count}}%忽略"}},"topics":{"reviewable_count":"计数","reported_by":"报告人","deleted":"[已删除的主题]","original":"（原主题）","details":"详情","unique_users":{"other":"{{count}} 位用户"}},"replies":{"other":"{{count}} 个回复"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"all_categories":"（所有分类）","type":{"all":"(全部类型)"},"minimum_score":"最低分：","status":"状态","orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）","medium":"中","high":"高"}},"conversation":{"view_full":"查看完整对话"},"scores":{"about":"该分数是根据报告者的信任等级、该用户以往举报的准确性以及被举报条目的优先级计算得出的。","score":"评分","date":"日期","status":"状态","submitted_by":"提交人","reviewed_by":"审核者"},"statuses":{"approved":{"title":"已批准"},"ignored":{"title":"忽略"},"deleted":{"title":"已删除"},"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_flagged_post":{"title":"被标记的帖子","flagged_by":"标记者"},"reviewable_queued_topic":{"title":"队列中到主题"},"reviewable_queued_post":{"title":"队列中的帖子"}},"approval":{"pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子在等待审核中。"}}},"directory":{"last_updated":"最近更新："},"groups":{"member_added":"已添加","member_requested":"请求于","add_members":{"description":"管理该群组的成员","usernames":"用户名"},"requests":{"title":"请求","accept":"接受","accepted":"已接受","deny":"拒绝","denied":"已拒绝","undone":"撤销请求","handle":"处理成员请求"},"manage":{"title":"管理","interaction":{"title":"交互","notification":"通知"},"membership":{"title":"成员资格","access":"访问"}},"empty":{"requests":"没有请求加入此群组的请求。","mentions":"群组从未被提及过。","messages":"群组从未发送过私信。","topics":"群组的成员从未发表主题。","logs":"没有关于群组的日志。"},"join":"加入","leave":"离开","request":"请求","confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","membership_request_template":"用户发送会员请求时向其显示的自定义模板","membership_request":{"submit":"提交成员申请","title":"申请加入%{group_name}","reason":"向群组拥有者说明你为何属于这个群组"},"membership":"成员资格","group_name":"群组名","index":{"all":"所有群组","empty":"没有可见的群组。","filter":"根据群组类型筛选","owner_groups":"拥有的群组","close_groups":"关闭的群组","automatic_groups":"自动群组","closed":"已关闭","public":"公开","private":"私密","public_groups":"公开的群组","close_group":"关闭群组","group_type":"群组类别","is_group_owner":"所有者"},"title":{"other":"群组"},"members":{"remove_member":"移除成员","remove_member_description":"从群组中移除\u003cb\u003e%{username}\u003c/b\u003e","make_owner":"设为所有者","make_owner_description":"使\u003cb\u003e%{username}\u003c/b\u003e成为群组所有者","remove_owner":"撤销所有者","remove_owner_description":"把\u003cb\u003e%{username}\u003c/b\u003e从群组所有者中移除","owner":"所有者","forbidden":"你不可以查看成员列表。"},"notification_level":"群组私信的默认通知等级","alias_levels":{"mentionable":"谁能@该群组","messageable":"谁能私信此群组","owners_mods_and_admins":"仅群组成员、版主与管理员"},"notifications":{"watching_first_post":{"description":"你将收到有关此组中新消息的通知，但不会回复消息。"},"muted":{"description":"你不会收到有关此组中消息的任何通知。"}},"flair_url":"头像图片","flair_url_placeholder":"（可选）图片 URL 或 Font Awesome class","flair_url_description":"使用不小于20px × 20px的方形图像或FontAwesome图标（可接受的格式：“fa-icon”，“far fa-icon”或“fab fa-icon”）。","flair_bg_color":"头像背景颜色","flair_bg_color_placeholder":"（可选）十六进制色彩值","flair_color":"头像颜色","flair_color_placeholder":"（可选）十六进制色彩值"},"user_action_groups":{"15":"草稿"},"categories":{"topic_stat_sentence_week":{"other":"过去一周有%{count}个新主题。"},"topic_stat_sentence_month":{"other":"过去一个月有%{count}个新主题。"},"n_more":"分类 (还有%{count}个分类) ..."},"ip_lookup":{"powered_by":"使用\u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"已复制"},"user":{"download_archive":{"button_text":"全部下载"},"user_notifications":{"ignore_duration_title":"忽略计时器","ignore_duration_when":"持续时间：","ignore_duration_save":"忽略","ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_duration_time_frame_required":"请选择时间范围","ignore_no_users":"你没有忽视任何用户","ignore_option":"忽略","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","add_ignored_user":"添加...","mute_option_title":"你不会收到任何关于此用户的通知","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","profile_hidden":"此用户公共信息已被隐藏。","collapse_profile":"折叠","timezone":"时区","desktop_notifications":{"label":"实时通知","consent_prompt":"有回复时是否接收通知？"},"dynamic_favicon":"在浏览器图标上显示计数","theme_default_on_all_devices":"将其设为我所有设备上的默认主题","text_size_default_on_all_devices":"将其设为我所有设备上的默认字体大小","allow_private_messages":"允许其他用户发送私信给我","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","silenced_tooltip":"该用户已被禁言。","suspended_permanently":"该用户被封禁了。","mailing_list_mode":{"label":"邮件列表模式","enabled":"启用邮件列表模式","instructions":"此设置将覆盖活动摘要。\u003cbr /\u003e\n静音主题和分类不包含在这些邮件中。\n","individual_no_echo":"为每个除了我发表的新帖发送一封邮件通知","warning":"邮件列表模式启用。邮件通知设置被覆盖。"},"muted_categories_instructions":"你不会收到有关这些分类中新主题的任何通知，也不会出现在类别或最新页面上。","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","no_category_access":"无法保存，作为审核人你仅具有受限的 分类 访问权限","delete_yourself_not_allowed":"想删除账户请联系管理人员。","ignored_users":"忽视","ignored_users_instructions":"封禁所有来自这些用户的帖子和通知。","api_last_used_at":"最后使用于：","home":"默认主页","staged":"暂存","staff_counters":{"rejected_posts":"被驳回的帖子"},"preferences_nav":{"interface":"界面"},"second_factor_backup":{"title":"两步备份码","enable_long":"启用备份码","manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","copied_to_clipboard":"已复制到剪贴板","copy_to_clipboard_error":"复制到剪贴板时出错","remaining_codes":"你有\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。","codes":{"title":"备份码生成","description":"每个备份码只能使用一次。请存放于安全可读的地方。"}},"second_factor":{"title":"双重验证","enable":"管理两步验证","forgot_password":"忘记密码？","confirm_password_description":"请确认密码后继续","label":"编码","rate_limit":"请等待另一个验证码。","enable_description":"使用我们支持的应用 (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) 扫描此二维码并输入您的授权码。\n","disable_description":"请输入来自 app 的验证码","show_key_description":"手动输入","short_description":"使用一次性安全码保护你的账户。\n","extended_description":"双重验证要求你的密码之外的一次性令牌，从而为你的账户增加了额外的安全性。可以在\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e和\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e设备上生成令牌。\n","oauth_enabled_warning":"请注意，一旦你的账户启用了双重验证，社交登录将被停用。","use":"使用身份验证器应用","enforced_notice":"在访问此站点之前，你需要启用双重身份验证。","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"register":"注册","title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_username":{"confirm":"你确定要更改用户名吗？"},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"email":{"primary":"主邮箱","secondary":"次邮箱","no_secondary":"没有次邮箱","sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。"},"associated_accounts":{"title":"关联账户","connect":"连接","not_connected":"（没有连接）","confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"auth_tokens":{"title":"最近使用的设备","log_out_all":"全部登出","active":"现在活跃","not_you":"不是你？","show_all":"显示所有（{{count}}）","show_few":"显示部分","was_this_you":"这是你吗？","was_this_you_description":"如果不是你，我们建议你更改密码并在任何地方注销。","browser_and_device":"{{browser}}在{{device}}","secure_account":"保护我的账户","latest_post":"你上次发布了......"},"hide_profile_and_presence":"隐藏我的公开个人资料和状态功能","enable_physical_keyboard":"在iPad上启用物理键盘支持","text_size":{"title":"文本大小","smaller":"更小","larger":"更大","largest":"最大"},"title_count_mode":{"title":"背景页面标题显示计数：","notifications":"新通知","contextual":"新建页面内容"},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件","every_month":"每月","every_six_months":"每6个月"},"email_level":{"only_when_away":"只在离开时"},"notification_level_when_replying":"当我在主题中回复后，将主题设置至","invited":{"sent":"上次发送","none":"无邀请显示。","rescind_all":"移除所有过期邀请","rescinded_all":"所有过期邀请已删除！","rescind_all_confirm":"你确定你想要移除所有过期邀请么？","reinvite_all_confirm":"确定要重发这些邀请吗？","link_generated":"邀请链接生成成功！","valid_for":"邀请链接只对这个邮件地址有效：%{email}","bulk_invite":{"none":"你还没有邀请任何人。你可以单独邀请用户，也可以通过\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e上传CSV文件\u003c/a\u003e批量邀请。","confirmation_message":"你将通过电子邮件将邀请发送给在上传的文件中的每一个人。"}},"summary":{"recent_time_read":"最近阅读时间","likes_given":{"other":"送出"},"likes_received":{"other":"收到"},"topics_entered":{"other":"已阅主题"},"top_categories":"热门分类"}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"last_post":"最后发帖","time_read_recently":"最近 %{time_read}","time_read_tooltip":"合计阅读时间 %{time_read}","time_read_recently_tooltip":"总阅读时间 %{time_read}（最近60天 %{recent_time_read}）","signup_cta":{"intro":"你好！看起来你正在享受讨论，但还没有注册一个账户。","value_prop":"当你创建了账户，我们就可以准确地记录你的阅读进度，你再次访问时就可以回到之前离开的地方。当有人回复你，你可以通过这里或电子邮件收到通知。并且你还可以通过点赞帖子向他人分享你的喜爱之情。:heartbeat:"},"private_message_info":{"invite":"邀请其他人...","edit":"添加或移除...","leave_message":"你真的想要发送消息么？"},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","help":"没收到邮件？请先查看你的垃圾邮件文件夹。\u003cp\u003e不确定使用了哪个邮箱地址？输入邮箱地址来查看是否存在。\u003c/p\u003e\u003cp\u003e如果你已无法进入你账户的邮箱，请联系\u003ca href='%{basePath}/about'\u003e我们的工作人员。\u003c/a\u003e\u003c/p\u003e","button_help":"帮助"},"email_login":{"link_label":"给我通过邮件发送一个登录链接","button_label":"通过邮件","complete_username":"如果有一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email":"如果\u003cb\u003e%{email}\u003c/b\u003e与账户相匹配，你很快就会收到一封带有登录链接的电子邮件。","complete_username_found":"我们找到了一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email_found":"我们发现了一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_title":"双重验证","second_factor_description":"请输入来自 app 的验证码：","second_factor_backup":"使用备用码登录","second_factor_backup_title":"两步验证备份","second_factor_backup_description":"请输入你的备份码：","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","blank_username":"请输入你的邮件地址或用户名。","omniauth_disallow_totp":"你的账户已启用双重验证，请使用密码登录。","sent_activation_email_again_generic":"我们发送了另一封激活邮件。它可能需要几分钟才能到达；记得检查你的垃圾邮件文件夹。","instagram":{"name":"Instagram"},"facebook":{"name":"Facebook"},"github":{"name":"GitHub"},"discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"invites":{"optional_description":"（可选）"},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_and_top_topics":"分类和最热主题","categories_boxes":"带子分类的框","categories_boxes_with_topics":"有特色主题的框"},"shortcut_modifier_key":{"enter":"回车"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"default_header_text":"选择…","no_content":"无符合的结果","filter_placeholder":"搜索……","filter_placeholder_with_any":"搜索或创建...","create":"创建：“{{content}}”","max_content_reached":{"other":"你只能选择 {{count}} 条记录。"},"min_content_not_reached":{"other":"选择至少{{count}}条。"},"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"emoji_picker":{"filter_placeholder":"查找表情符号","smileys_\u0026_emotion":"笑脸与情感","people_\u0026_body":"人与身体","animals_\u0026_nature":"动物与自然","food_\u0026_drink":"饮食","travel_\u0026_places":"旅行与地点","activities":"活动","objects":"物品","symbols":"符号","recent":"近期使用","default_tone":"无肤色","light_tone":"浅肤色","medium_light_tone":"中浅肤色","medium_tone":"中间肤色","medium_dark_tone":"中深肤色","dark_tone":"深肤色","default":"自定义表情符号"},"shared_drafts":{"title":"共享草稿","notice":"只有那些可以看到\u003cb\u003e{{category}}\u003c/b\u003e分类的人才能看到此主题。","destination_category":"目标分类","publish":"发布共享草稿","confirm_publish":"你确定要发布此草稿吗？","publishing":"发布主题中......"},"composer":{"edit_conflict":"编辑冲突","group_mentioned_limit":"\u003cb\u003e警告！\u003c/b\u003e你提到了\u003ca href='{{group_link}}'\u003e {{group}} \u003c/a\u003e，但该群组的成员数超过了的管理员配置的最大{{max}}人数。没人会收到通知。","cannot_see_mention":{"category":"你提到了 {{username}} ，然而他们不能访问该分类，所以他们不会被通知。你需要把他们加入到能访问该分类的群组中。"},"duplicate_link":"好像\u003cb\u003e@{{username}}\u003c/b\u003e在\u003ca href='{{post_url}}'\u003e{{ago}}\u003c/a\u003e中前的回复中已经发了你的链接 \u003cb\u003e{{domain}}\u003c/b\u003e － 你想再次发表链接吗？","reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","try_like":"试试{{heart}}按钮？","tags_missing":"你必须至少选择{{count}}个标签","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"overwrite_edit":"覆盖编辑","create_whisper":"密语","create_shared_draft":"创建共享草稿","edit_shared_draft":"编辑共享草稿","topic_featured_link_placeholder":"在标题里输入链接","remove_featured_link":"从主题中移除链接。","reply_placeholder_no_images":"在此输入。 使用 Markdown，BBCode 或 HTML 格式。","reply_placeholder_choose_category":"输入前请选择一个分类。","saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","toggle_direction":"切换方向","collapse":"最小化编辑面板","open":"打开编辑面板","abandon":"关闭编辑面板并放弃草稿","enter_fullscreen":"进入全屏编辑模式","exit_fullscreen":"退出全屏编辑模式","composer_actions":{"draft":"草稿","reply_to_post":{"label":"通过%{postUsername}回复帖子%{postNumber}","desc":"回复特定帖子"},"reply_as_new_topic":{"label":"回复为联结主题","desc":"创建一个新主题链接到这一主题","confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"},"reply_as_private_message":{"label":"新消息","desc":"新建一个私信"},"reply_to_topic":{"label":"回复主题","desc":"回复主题，不是任何特定的帖子"},"toggle_whisper":{"label":"切换密语","desc":"只有管理人员才能看到密语"},"shared_draft":{"label":"共享草稿","desc":"起草一个只对管理人员可见的主题"},"toggle_topic_bump":{"label":"切换主题置顶","desc":"回复而不更改最新回复日期"}},"details_text":"此本文本将被隐藏"},"notifications":{"tooltip":{"regular":{"other":"{{count}} 个未读通知"},"message":{"other":"{{count}} 条未读私信"},"high_priority":{"other":"%{count}个未读的高优先级通知"}},"post_approved":"你的帖子已被审核","reviewable_items":"待审核帖子","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"other":"\u003cspan\u003e{{username}}, {{username2}} 和其他 {{count}} 人\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"other":"你的帖子有{{count}}个赞"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e 已接受你的邀请","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e 移动了 {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"获得 “{{description}}”","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003e新主题\u003c/span\u003e {{description}}","membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","group_message_summary":{"other":"{{count}} 条私信在{{group_name}}组的收件箱中"},"popup":{"private_message":"{{username}}在“{{topic}}”中向你发送了个人消息 - {{site_title}}","watching_first_post":"{{username}}发布了新主题“{{topic}}” - {{site_title}}","confirm_title":"通知已启用 - %{site_title}","confirm_body":"成功！通知已启用。","custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","liked":"新到赞","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","post_approved":"帖子已审批","membership_request_consolidated":"新的成员申请"}},"search":{"result_count":{"other":"\u003cspan\u003e{{count}}{{plus}}结果\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"full_page_title":"搜索主题或帖子","results_page":"关于“{{term}}”的搜索结果","more_results":"还有更多结果。请增加你的搜索条件。","cant_find":"找不到你要找的内容？","start_new_topic":"不如创建一个新主题？","or_search_google":"或者尝试使用Google进行搜索：","search_google":"尝试使用Google进行搜索：","context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"in_category":{"label":"分类"},"with_tags":{"label":"标签"},"filters":{"label":"只返回主题/帖子……","title":"仅在标题中匹配","likes":"我赞过的","posted":"我参与发帖","created":"我创建的","watching":"我正在监看","tracking":"我正在追踪","private":"在我的私信中","bookmarks":"我收藏了","first":"是第一帖","pinned":"是置顶的","unpinned":"不是置顶的","seen":"我看了","unseen":"我还没看过","wiki":"公共编辑","images":"包含图片","all_tags":"上述所有标签"},"statuses":{"label":"当主题","open":"是开放的","closed":"是关闭的","public":"是公开的","archived":"已经存档的","noreplies":"没有回复","single_user":"只有一个用户参与"},"post":{"count":{"label":"最小帖子数"},"time":{"label":"发表于","before":"之前","after":"之后"}}}},"view_all":"查看全部","topics":{"bulk":{"relist_topics":"把主题重新置于主题列表中","change_category":"设置分类","change_tags":"替换标签","append_tags":"添加标签","choose_append_tags":"为这些主题添加新标签："}},"topic":{"open_draft":"打开草稿","edit_message":{"help":"编辑消息中的第一帖","title":"编辑消息"},"defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"title":"主题计时器","save":"设置计时器","num_of_hours":"小时数：","num_of_days":"天数","remove":"撤销计时器","publish_to":"发布至：","when":"时间：","public_timer_types":"主题计时器","private_timer_types":"用户主题计时器","time_frame_required":"请选择一个时间范围"},"auto_update_input":{"none":"选择时间范围","later_today":"今天的某个时候","tomorrow":"明天","later_this_week":"这周的某个时候","this_weekend":"周末","next_week":"下个星期","two_weeks":"两周","next_month":"下个月","two_months":"两个月","three_months":"三个月","four_months":"四个月","six_months":"六个月","one_year":"一年","forever":"永远","pick_date_and_time":"选择日期和时间","set_based_on_last_post":"按照最新帖子关闭"},"publish_to_category":{"title":"计划发布"},"temp_open":{"title":"临时开启"},"auto_reopen":{"title":"自动开启主题"},"temp_close":{"title":"临时关闭"},"auto_close":{"title":"自动关闭主题","label":"自动关闭于几小时后："},"auto_delete":{"title":"自动删除主题"},"auto_bump":{"title":"自动顶帖"},"reminder":{"title":"提醒我"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_open":"本主题将在%{timeLeft}自动开启。","auto_publish_to_category":"主题%{timeLeft}将发布到\u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e 。","auto_delete":"主题在%{timeLeft}后将被自动删除。","auto_bump":"此主题将在%{timeLeft}后自动顶起。","auto_reminder":"你将在%{timeLeft}后收到该主题的提醒。","auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"auto_close_immediate":{"other":"主题中的最后一帖是 %{hours} 小时前发出的，所以主题将会立即关闭。"},"progress":{"jump_prompt":"跳到…","jump_prompt_of":"%{count} 帖子","jump_prompt_long":"跳到……","jump_prompt_to_date":"至今"},"notifications":{"reasons":{"mailing_list_mode":"邮件列表模式已启用，将以邮件通知你关于该主题的回复。"}},"actions":{"timed_update":"设置主题计时器…","make_private":"设置为私信","reset_bump_date":"重置顶帖日期"},"share":{"extended_title":"分享一个链接"},"print":{"title":"打印","help":"打开该主题对打印友好的版本"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"invite_private":{"success_group":"成功邀请了群组至该私信。"},"invite_reply":{"success_existing_email":"用户\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e已存在。我们已经邀请了该用户参与该主题。"},"move_to":{"title":"移动到","action":"移动到","error":"移动帖子时发生了错误。"},"split_topic":{"topic_name":"新主题的标题"},"merge_topic":{"radio_label":"现存的主题"},"move_to_new_message":{"title":"移动到新的即时信息","action":"移动到新的私信","message_title":"新私信的标题","participants":"参与者","instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"title":"移动到现存的私信","action":"移动到已存在的私信","radio_label":"现存的私信","participants":"参与者","instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"title":"更改所有者","instructions":{"other":"请选择\u003cb\u003e@{{old_user}}\u003c/b\u003e创建的{{count}}个帖子的新作者。"},"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"change_timestamp":{"title":"修改时间"},"multi_select":{"select_post":{"title":"将帖子加入选择"},"selected_post":{"label":"已选中","title":"单击以将帖子从中移除"},"select_replies":{"title":"选择帖子及其所有回复"},"select_below":{"label":"选择 +以下","title":"选择帖子及其后的所有内容"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"quote_reply":"引用","ignored":"忽视的内容","wiki_last_edited_on":"维基最后修改于","reply_as_new_private_message":"向相同的收件人回复新私信","show_hidden":"显示已忽略内容。","collapse":"折叠","locked":"一管理人员锁定了该帖的编辑","notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。","upload_not_authorized":"抱歉，你没有上传文件的权限（验证扩展：{{authorized_extensions}}）。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"controls":{"read_indicator":"阅读了帖子的用户","delete_replies":{"confirm":"你也想删除该贴的回复？","direct_replies":{"other":"是，{{count}}个直接回复"},"all_replies":{"other":"是，所有{{count}}个回复"}},"lock_post":"锁定帖子","lock_post_description":"禁止发帖者编辑这篇帖子","unlock_post":"解锁帖子","unlock_post_description":"允许发布者编辑帖子","delete_topic_disallowed_modal":"你无权删除该贴。如果你真想删除，向版主提交原因并标记。","delete_topic_disallowed":"你无权删除此主题","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"defer_flags":{"other":"忽略标记"},"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"like_capped":{"other":"和其他 {{count}} 人赞了它"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"delete":{"confirm":{"other":"你确定要删除{{count}}个帖子吗？"}},"merge":{"confirm":{"other":"确定要合并这 {{count}} 个帖子吗？"}},"revisions":{"controls":{"edit_wiki":"编辑维基","edit_post":"编辑帖子","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"side_by_side_markdown":{"button":"原始"}}},"raw_email":{"displays":{"raw":{"title":"显示原始邮件地址","button":"原始"},"text_part":{"title":"显示邮件的文字部分"},"html_part":{"title":"显示邮件的 HTML 部分"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"choose":"分类\u0026hellip;","edit_dialog_title":"编辑: %{categoryName}","tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","topic_featured_link_allowed":"允许在该分类中发布特色链接标题","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","show_subcategory_list":"在这个分类中把子分类列表显示在主题的上面","num_featured_topics":"分类页面上显示的主题数量：","subcategory_num_featured_topics":"父分类页面上的推荐主题数量：","all_topics_wiki":"默认将新主题设为维基主题","subcategory_list_style":"子分类列表样式：","sort_order":"主题排序依据：","default_view":"默认主题列表：","default_top_period":"默认热门时长：","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","require_topic_approval":"所有新主题需要版主审批","require_reply_approval":"所有新回复需要版主审批","position":"分类页面位置：","minimum_required_tags":"在一个主题中至少含有多少个标签：","num_auto_bump_daily":"每天自动碰撞的主题的数量","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching":{"description":"你将自动关注这些分类中的所有主题。你会收到所有新主题中的每一个新帖的通知，还会显示新回复的数量。"},"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"},"tracking":{"description":"你将自动跟踪这些分类中的所有主题。如果有人@你或回复你，将通知你，还将显示新回复的数量。"}},"search_priority":{"label":"搜索优先级","options":{"ignore":"忽视","very_low":"非常低","low":"低","high":"高","very_high":"非常高"}},"sort_options":{"default":"默认","op_likes":"原始帖子赞","posters":"发表人","votes":"投票"},"sort_ascending":"升序","sort_descending":"降序","subcategory_list_styles":{"rows":"行","rows_with_featured_topics":"有推荐主题的行","boxes":"盒子","boxes_with_featured_topics":"有推荐主题的盒子"},"settings_sections":{"moderation":"审核","appearance":"主题"}},"flagging":{},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"views_long":{"other":"本主题已经被浏览过 {{number}} 次"},"raw_email":{"title":"进站邮件"},"filters":{"votes":{"title":"推荐","help":"选票最多的主题"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","jump_to":{"drafts":"%{shortcut}草稿"},"navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"application":{"search":"%{shortcut} 搜索"},"composing":{"title":"编辑","return":"%{shortcut}返回编辑器","fullscreen":"%{shortcut}全屏编辑器"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"badges":{"successfully_granted":"成功将 %{badge} 授予 %{username}"},"tagging":{"other_tags":"其他标签","choose_for_topic":"可选标签","info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm":{"other":"你确定你想要删除这个标签以及撤销在{{count}}个主题中的关联么？"},"delete_confirm_no_topics":"你确定你想要删除这个标签吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"manage_groups":"管理标签组","manage_groups_description":"管理标签的群组","upload":"上传标签","upload_description":"上传csv文件以批量创建标签","upload_instructions":"每行一个，可选带有'tag_name，tag_group'格式的标签组。","upload_successful":"标签上传成功","delete_unused_confirmation":{"other":"%{count}标签将被删除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}和%{count}更多"},"delete_unused":"删除未使用的标签","delete_unused_description":"删除所有未与主题或私信关联的标签","notifications":{"watching":{"description":"你将自动监看所有含有此标签的主题。你将收到所有新帖子和主题的通知，此外，主题旁边还会显示未读和新帖子的数量。"},"watching_first_post":{"description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"},"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}},"groups":{"tags_placeholder":"标签","name_placeholder":"标签组名称","everyone_can_use":"每个人都可以使用标签","usable_only_by_staff":"标签对所有人可见，但只有管理人员可以使用它们","visible_only_to_staff":"标签仅对管理人员可见"}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","safe_mode":{"enabled":"安全模式已经开启，关闭该浏览器窗口以退出安全模式"},"poll":{"public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项","invalid_values":"最小值必须小于最大值。","min_step_value":"最小步长为1"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"today":"今天%{time}","tomorrow":"明天%{time}","yesterday":"昨天%{time}","countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"insert":"插入","advanced_mode":"高级模式","simple_mode":"简单模式","format_description":"向用户显示日期的格式。 使用“\\T\\Z”以单词显示用户时区（欧洲/巴黎）","timezones_title":"要显示的时区","timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_title":"循环","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","recurring_none":"没有循环","invalid_date":"日期无效，请确保日期和时间正确","date_title":"日期","format_title":"日期格式","timezone":"时区","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"details":{"title":"隐藏详情"},"presence":{"replying":"正在回复","editing":"正在编辑","replying_to_topic":{"other":"正在回复"}},"voting":{"title":"投票","reached_limit":"你没有选票了，先删除一张已选票！","list_votes":"显示你的投票","votes_nav_help":"选票最多的主题","voted":"你在该主题中已经投过票了","allow_topic_voting":"允许用户在此分类中为主帖点推荐","vote_title_plural":"推荐","voted_title":"已投票","voting_closed_title":"已结束推荐","voting_limit":"次数限制","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"},"adplugin":{"advertisement_label":"广告"}}},"en":{"js":{"dates":{"tiny":{"less_than_x_minutes":{"one":"\u003c %{count}m"},"x_months":{"one":"%{count}mon"}},"medium_with_ago":{"x_months":{"one":"%{count} month ago"},"x_years":{"one":"%{count} year ago"}}},"topic_count_latest":{"one":"See {{count}} new or updated topic"},"topic_count_unread":{"one":"See {{count}} unread topic"},"topic_count_new":{"one":"See {{count}} new topic"},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"groups":{"title":{"one":"Group"}},"categories":{"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"},"summary":{"likes_given":{"one":"given"},"likes_received":{"one":"received"},"topics_entered":{"one":"topic viewed"}}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"select_kit":{"max_content_reached":{"one":"You can only select {{count}} item."},"min_content_not_reached":{"one":"Select at least {{count}} item."}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification"},"message":{"one":"%{count} unread message"},"high_priority":{"one":"%{count} unread high priority notification"}},"liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts"},"group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topic":{"auto_close_immediate":{"one":"The last post in the topic is already %{count} hour old, so the topic will be closed immediately."},"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"defer_flags":{"one":"Ignore flag"},"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want to merge those posts?"}}},"views_long":{"one":"this topic has been viewed %{count} time"},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'sq';
I18n.pluralizationRules.sq = MessageFormat.locale.sq;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var sq = moment.defineLocale('sq', {
        months : 'Janar_Shkurt_Mars_Prill_Maj_Qershor_Korrik_Gusht_Shtator_Tetor_Nëntor_Dhjetor'.split('_'),
        monthsShort : 'Jan_Shk_Mar_Pri_Maj_Qer_Kor_Gus_Sht_Tet_Nën_Dhj'.split('_'),
        weekdays : 'E Diel_E Hënë_E Martë_E Mërkurë_E Enjte_E Premte_E Shtunë'.split('_'),
        weekdaysShort : 'Die_Hën_Mar_Mër_Enj_Pre_Sht'.split('_'),
        weekdaysMin : 'D_H_Ma_Më_E_P_Sh'.split('_'),
        weekdaysParseExact : true,
        meridiemParse: /PD|MD/,
        isPM: function (input) {
            return input.charAt(0) === 'M';
        },
        meridiem : function (hours, minutes, isLower) {
            return hours < 12 ? 'PD' : 'MD';
        },
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[Sot në] LT',
            nextDay : '[Nesër në] LT',
            nextWeek : 'dddd [në] LT',
            lastDay : '[Dje në] LT',
            lastWeek : 'dddd [e kaluar në] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'në %s',
            past : '%s më parë',
            s : 'disa sekonda',
            ss : '%d sekonda',
            m : 'një minutë',
            mm : '%d minuta',
            h : 'një orë',
            hh : '%d orë',
            d : 'një ditë',
            dd : '%d ditë',
            M : 'një muaj',
            MM : '%d muaj',
            y : 'një vit',
            yy : '%d vite'
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return sq;

})));

// moment-timezone-localization for lang code: sq

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abixhan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Akra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Adis-Ababë","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algjer","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmarë","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banxhul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bisau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantirë","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazavillë","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Buxhumburë","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Kajro","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Kazablankë","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Theuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Konakri","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar-es-Salam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Xhibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Ajun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Fritaun","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johanesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Xhuba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Kartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Librevilë","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadishu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamej","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakot","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Uagëdugu","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Sao-Tome","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tuniz","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Vint’huk","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Ankorejxh","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilë","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguajana","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioha","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio-Galegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Saltë","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San-Huan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"Shën-Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tukuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaja","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Arubë","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunsion","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia-Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belizë","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blank-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa-Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotë","id":"America/Bogota"},{"value":"America/Boise","name":"Boizë","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos-Ajres","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Gjiri i Kembrixhit","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Kampo-Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Kankun","id":"America/Cancun"},{"value":"America/Caracas","name":"Karakas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Katamarka","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Kajenë","id":"America/Cayenne"},{"value":"America/Cayman","name":"Kajman","id":"America/Cayman"},{"value":"America/Chicago","name":"Çikago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Çihahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Kordoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Kosta-Rikë","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Kreston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Kujaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Kurasao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Denmarkshavën","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Douson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Gjiri i Dousonit","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominikë","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Ejrunep","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort-Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Gjiri i Ngrirë","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Njuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Gjiri i Patës","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Turku i Madh","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Granadë","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadelupë","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemalë","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guajakuil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guajanë","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifaks","id":"America/Halifax"},{"value":"America/Havana","name":"Havanë","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosijo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knoks, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petërsburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell-Siti, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevëj, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincenes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Uinamak, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Ikaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Xhamajkë","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Huhui","id":"America/Jujuy"},{"value":"America/Juneau","name":"Xhunou","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Montiçelo, Kentaki","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Limë","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Anxhelos","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Luizvilë","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Louer-Prinsis-Kuortër","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Makejo","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinikë","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menomini","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Qyteti i Meksikës","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Mikelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Monkton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrej","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nasao","id":"America/Nassau"},{"value":"America/New_York","name":"Nju-Jork","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronja","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beula, Dakota e Veriut","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Qendër, Dakota e Veriut","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"Nju-Salem, Dakota e Veriut","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ohinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Feniks","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-o-Prins","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto-Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Porto-Riko","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta-Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Lumi i Shirave","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Gryka Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Rexhina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio-Branko","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa-Izabela","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo-Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Sao-Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Itokorturmit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Sen-Bartelemi","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Shën-Gjon","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Shën-Kits","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Shën-Luçia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Shën-Tomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Shën-Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Rryma e Shpejtë","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegusigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Dhule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Gjiri i Bubullimës","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tihuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortolë","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vankuver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Uajt’hors","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Uinipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Jakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Jellounajf","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Kejsi","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Dejvis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont-d’Urvilë","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Mekuari","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mauson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"Mekmurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rodherë","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Sjoua","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Long’jëbjen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almati","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Aman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadir","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ashgabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atirau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrejn","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Bejrut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bishkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kalkutë","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Çita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Çoibalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Kolombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damask","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Daka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dushanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagustë","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong-Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Xhakartë","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Xhajapurë","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerusalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamçatkë","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karaçi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Kandigë","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala-Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuçing","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuvajt","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Makao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makasar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manilë","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Muskat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nikozia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Pnom-Pen","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Penian","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Katar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kizilorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangun","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho-Çi-Min","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sakalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Shangai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapor","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolimsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Tajpej","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Tashkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilis","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimpu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulanbatar","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vjentianë","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Ekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Jerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azore","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermude","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Kanari","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kepi i Gjelbër","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Faroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reikjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Xhorxha e Jugut","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Shën-Elenë","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stenli","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelajde","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbejn","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Brokën-Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Kuri","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darvin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eukla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindëmen","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord-Houi","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melburn","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Përth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sidnej","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Ora universale e koordinuar","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorrë","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Athinë","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Beograd","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislavë","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bruksel","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukuresht","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Kishineu","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kopenhagen","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Ora strandarde e IrlandësDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gjibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Gernsej","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Ishulli i Manit","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Stamboll","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Xhersej","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisbonë","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Lubjanë","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Ora verore britanikeLondër","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luksemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Maltë","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monako","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskë","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paris","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgoricë","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Pragë","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Rigë","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Romë","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San-Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevë","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Shkup","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofje","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stokholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Talin","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tiranë","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uljanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Uzhgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikan","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Vjenë","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varshavë","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporozhje","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zyrih","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Çagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Krishtlindje","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Kokos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Komore","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldive","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Majotë","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Okland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bunganvilë","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Çatman","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Pashkë","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbur","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fixhi","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalkanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Xhonston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimat","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosre","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kuaxhalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Mahuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Markez","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Miduej","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Noumea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago-Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitkern","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Ponapei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port-Moresbi","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotongë","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Taravë","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Çuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Uejk","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Uollis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
