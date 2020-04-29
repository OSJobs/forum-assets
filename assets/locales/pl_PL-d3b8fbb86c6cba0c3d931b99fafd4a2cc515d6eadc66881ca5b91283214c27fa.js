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
I18n._compiledMFs = {"too_few_topics_and_posts_notice_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "too_few_topics_notice_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "too_few_posts_notice_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "logs_error_rate_notice.reached_minute_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "logs_error_rate_notice.exceeded_hour_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "logs_error_rate_notice.exceeded_minute_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"plural\" or \"select\" but \"l\" found. at undefined:1376:10";}, "topic.read_more_MF" : function(d){
var r = "";
r += "Masz do zobaczenia ";
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
r += "is <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 nieprzeczytany</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nieprzeczytanych</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pl_PL"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
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
r += "/new'>1 nowy</a> temat";
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
r += "and ";
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
})() + " nowych</a> tematów";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pl_PL"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", lub ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "przeglądaj inne tematy w ";
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
}, "topic.bumped_at_title_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["FIRST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["CREATED_AT"];
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LAST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["BUMPED_AT"];
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Zamierzasz usunąć ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> post";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pl_PL"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " i ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> topic";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pl_PL"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " tematów użytkownika, usunąć jego konto, zablokować możliwość zakładania kont z jego adresu IP <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> i dodać jego email <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> do listy trwale zablokowanych. Czy na pewno ten użytkownik jest spamerem?";
return r;
}, "posts_likes_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \",\" but \"l\" found. at undefined:1376:10";}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "Zamierzasz usunąć ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 post";
return r;
},
"few" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " posty";
return r;
},
"many" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " postów";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " postów";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pl_PL"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " i ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 temat";
return r;
},
"few" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " tematy";
return r;
},
"many" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " tematów";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " tematów";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pl_PL"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Czy jesteś pewien?";
return r;
}};
MessageFormat.locale.pl_PL = function (n) {
  if (n == 1) {
    return 'one';
  }
  if ((n % 10) >= 2 && (n % 10) <= 4 &&
      ((n % 100) < 12 || (n % 100) > 14) && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 10) === 0 || n != 1 && (n % 10) == 1 ||
      ((n % 10) >= 5 && (n % 10) <= 9 || (n % 100) >= 12 && (n % 100) <= 14) &&
      n == Math.floor(n)) {
    return 'many';
  }
  return 'other';
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

I18n.translations = {"pl_PL":{"js":{"number":{"format":{"separator":",","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","many":"bajtów","other":"bajtów"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","time_with_zone":"H:mm (z)","time_short_day":"ddd, GG: mm","timeline_date":"MMM YYYY","long_no_year":"D MMM, GG: mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM YYYY H:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} temu","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","few":"\u003c %{count}s","many":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","few":"%{count}s","many":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count} min","few":"\u003c %{count} min","many":"\u003c %{count} min ","other":"\u003c %{count} min "},"x_minutes":{"one":"%{count}m","few":"%{count}m","many":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}h","few":"%{count}h","many":"%{count}h","other":"%{count}h"},"x_days":{"one":"%{count}d","few":"%{count}d","many":"%{count}d","other":"%{count}d"},"x_months":{"one":"%{count}mies","few":"%{count}mies","many":"%{count}mies","other":"%{count}mies"},"about_x_years":{"one":"%{count}r","few":"%{count}r","many":"%{count}r","other":"%{count}r"},"over_x_years":{"one":"\u003e %{count}r","few":"\u003e %{count}r","many":"\u003e %{count}r","other":"\u003e %{count}r"},"almost_x_years":{"one":"%{count}r","few":"%{count}r","many":"%{count}r","other":"%{count}r"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} minuta","few":"%{count} minuty","many":"%{count} minut","other":"%{count} minut"},"x_hours":{"one":"%{count} godzina","few":"%{count} godziny","many":"%{count} godzin","other":"%{count} godzin"},"x_days":{"one":"%{count} dzień","few":"%{count} dni","many":"%{count} dni","other":"%{count} dni"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"minutę temu","few":"%{count} minuty temu","many":"%{count} minut temu","other":"%{count} minut temu"},"x_hours":{"one":"godzinę temu","few":"%{count} godziny temu","many":"%{count} godzin temu","other":"%{count} godzin temu"},"x_days":{"one":"wczoraj","few":"%{count} dni temu","many":"%{count} dni temu","other":"%{count} dni temu"},"x_months":{"one":"%{count} miesiąc temu","few":"%{count} miesięcy temu","many":"%{count} miesięcy temu","other":"%{count} miesięcy temu"},"x_years":{"one":"%{count} rok temu","few":"%{count} lat temu","many":"%{count} lat temu","other":"%{count} lat temu"}},"later":{"x_days":{"one":"%{count} dzień później","few":"%{count} dni później","many":"%{count} dni później","other":"%{count} dni później"},"x_months":{"one":"%{count} miesiąc później","few":"%{count} miesiące później","many":"%{count} miesięcy później","other":"%{count} miesięcy później"},"x_years":{"one":"%{count} rok później","few":"%{count} lata później","many":"%{count} lat później","other":"%{count} lat później"}},"previous_month":"Poprzedni miesiąc","next_month":"Następny miesiąc","placeholder":"data"},"share":{"topic_html":"Temat: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"wpis #%{postNumber}","close":"zamknij","twitter":"Udostępnij lnik na Twitter","facebook":"Udostępnij lnik na Facebook","email":"Wyślij link poprzez email"},"action_codes":{"public_topic":"Upublicznij ten temat %{when}","private_topic":"przekształcił ten temat w wiadomość prywatną %{when}","split_topic":"podziel ten temat %{when}","invited_user":"%{who} został zaproszony %{when}","invited_group":"%{who} został zaproszony %{when}","user_left":"%{who} usunął siebie z tej konwersacji %{when}","removed_user":"%{who} został usunięty %{when}","removed_group":"%{who} został usunięty %{when}","autobumped":"automatycznie podbity %{when}","autoclosed":{"enabled":"zamknięcie %{when}","disabled":"otworzenie %{when}"},"closed":{"enabled":"zamknięcie %{when}","disabled":"otworzenie %{when}"},"archived":{"enabled":"archiwizacja %{when}","disabled":"dearchiwizacja %{when}"},"pinned":{"enabled":"przypięcie %{when}","disabled":"odpięcie %{when}"},"pinned_globally":{"enabled":"globalne przypięcie %{when}","disabled":"globalne odpięcie %{when}"},"visible":{"enabled":"wylistowanie %{when}","disabled":"odlistowanie %{when}"},"banner":{"enabled":"ustawił ten baner %{when}. Będzie widoczny na górze każdej strony, póki nie zostanie ukryty przez użytkownika.","disabled":"Ten temat nie jest już banerem. Nie będzie dalej wyświetlany na górze każdej strony."},"forwarded":"przekazano powyższy email"},"topic_admin_menu":"akcje tematu","wizard_required":"Witaj na Twoim na nowym forum Discourse! Zacznijmy od \u003ca href='%{url}' data-auto-route='true'\u003ekreatora ustawień\u003c/a\u003e ✨","emails_are_disabled":"Wysyłanie e-maili zostało globalnie wyłączone przez administrację. Powiadomienia e-mail nie będą dostarczane.","bootstrap_mode_enabled":"Aby ułatwić uruchomienie Twojej strony, jesteś w trybie bootstrap. Wszyscy nowi użytkownicy otrzymają poziom zaufania 1 i będą otrzymywać codzienne wiadomości e-mail z podsumowaniem aktywności na forum. To zostanie automatycznie wyłączone, kiedy %{min_users} osób dołączy.","bootstrap_mode_disabled":"Tryb bootstrap zostanie wyłączony w ciągu 24 godzin.","themes":{"default_description":"Domyślny","broken_theme_alert":"Twoja strona może nie działać, bo motyw / komponent %{theme} zawiera błędy. Wyłącz go w %{path}."},"s3":{"regions":{"ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","ap_south_1":"Asia Pacific (Mumbai)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ca_central_1":"Kanada (centralna)","cn_north_1":"Chiny (Beijing)","cn_northwest_1":"Chiny (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"Europa (Sztokholm)","eu_west_1":"EU (Irlandia)","eu_west_2":"Europa (Londyn)","eu_west_3":"EU (Paris)","sa_east_1":"Ameryka Południowa (São Paulo)","us_east_1":"US East (N. Virginia)","us_east_2":"Wschodnie USA (Ohio)","us_gov_east_1":"AWS GovCloud (US-East)","us_gov_west_1":"AWS GovCloud (US-West)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)"}},"edit":"edytuj tytuł i kategorię tego tematu","expand":"Rozszerz","not_implemented":"Bardzo nam przykro, ale ta funkcja nie została jeszcze zaimplementowana.","no_value":"Nie","yes_value":"Tak","submit":"Prześlij","generic_error":"Przepraszamy, wystąpił błąd.","generic_error_with_reason":"Wystąpił błąd: %{error}","go_ahead":"Idź dalej","sign_up":"Rejestracja","log_in":"Logowanie","age":"Wiek","joined":"Dołączył","admin_title":"Administracja","show_more":"pokaż więcej","show_help":"opcje","links":"Odnośniki","links_lowercase":{"one":"link","few":"linki","many":"linków","other":"linków"},"faq":"FAQ","guidelines":"Przewodnik","privacy_policy":"Polityka prywatności","privacy":"Prywatność","tos":"Warunki użytkowania serwisu","rules":"Zasady","conduct":"Regulamin","mobile_view":"Wersja mobilna","desktop_view":"Wersja komputerowa","you":"Ty","or":"lub","now":"teraz","read_more":"więcej","more":"Więcej","less":"Mniej","never":"nigdy","every_30_minutes":"co 30 minut","every_hour":"co godzinę","daily":"dziennie","weekly":"tygodniowo","every_month":"każdego miesiąca","every_six_months":"co 6 miesięcy","max_of_count":"max z {{count}}","alternation":"lub","character_count":{"one":"%{count} znak","few":"{{count}} znaki","many":"{{count}} znaków","other":"{{count}} znaków"},"related_messages":{"title":"Wiadomości powiązane","see_all":"Zobacz \u003ca href=\"%{path}\"\u003ewszystkie wiadomości\u003c/a\u003e od @ %{username} ..."},"suggested_topics":{"title":"Sugerowane tematy","pm_title":"sugerowane wiadomości"},"about":{"simple_title":"O stronie","title":"O %{title}","stats":"Statystyki strony","our_admins":"Administratorzy","our_moderators":"Moderatoratorzy","moderators":"Moderatoratorzy","stat":{"all_time":"Ogółem","last_7_days":"Ostatnie 7","last_30_days":"Ostatnie 30"},"like_count":"Lajki","topic_count":"Tematy","post_count":"Wpisy","user_count":"Użytkownicy","active_user_count":"Aktywni użytkownicy","contact":"Kontakt","contact_info":"W sprawach wymagających szybkiej reakcji lub związanych z poprawnym funkcjonowaniem serwisu, prosimy o kontakt: %{contact_info}."},"bookmarked":{"title":"Zakładka","clear_bookmarks":"Wyczyść zakładki","help":{"bookmark":"Kliknij, aby dodać pierwszy wpis tematu do zakładek","unbookmark":"Kliknij, aby usunąć wszystkie zakładki z tego tematu"}},"bookmarks":{"created":"zakładka dodana","not_bookmarked":"dodaj do zakładek","created_with_at_desktop_reminder":"zakładka tego posta została dodana do zakładek, a następnym razem zostaniesz o tym powiadomiony","remove":"Usuń zakładkę","confirm_clear":"Czy na pewno chcesz usunąć wszystkie swoje zakładki ustawione w tym temacie?","save":"Zapisz","no_timezone":"Nie ustawiłeś jeszcze strefy czasowej. Nie będziesz mógł ustawić przypomnień. Skonfiguruj jeden \u003ca href=\"%{basePath}/my/preferences/profile\"\u003ew swoim profilu\u003c/a\u003e .","invalid_custom_datetime":"Podana data i godzina są nieprawidłowe, spróbuj ponownie.","list_permission_denied":"Nie masz uprawnień do przeglądania zakładek tego użytkownika.","reminders":{"at_desktop":"Następnym razem będę na swoim pulpicie","later_today":"Później dzisiaj","next_business_day":"Następny dzień roboczy","tomorrow":"Jutro","next_week":"Następny tydzień","later_this_week":"Później w tym tygodniu","start_of_next_business_week":"Następny poniedziałek","next_month":"Następny miesiąc","custom":"Niestandardowa data i godzina","last_custom":"Ostatni, ubiegły, zeszły","none":"Przypomnienie nie jest potrzebne"}},"drafts":{"resume":"Kontynuuj","remove":"Usuń","new_topic":"Nowy szkic tematu ","new_private_message":"Nowy szkic wiadomości prywatnej","topic_reply":"Szkic odpowiedzi","abandon":{"confirm":"Otworzyłeś już szkic w tym temacie. Czy jesteś pewny, że chcesz go porzucić?","yes_value":"Tak, porzuć","no_value":"Nie, zatrzymaj"}},"topic_count_latest":{"one":"Zobacz {{count}} nowy albo zaktualizowany temat","few":"Zobacz {{count}} nowe albo zaktualizowane tematy","many":"Zobacz {{count}} nowych albo zaktualizowanych tematów","other":"Zobacz {{count}} nowych albo zaktualizowanych tematów"},"topic_count_unread":{"one":"Zobacz {{count}} nieprzeczytany temat","few":"Zobacz {{count}} nieprzeczytane tematy","many":"Zobacz {{count}} nieprzeczytanych tematów","other":"Zobacz {{count}} nieprzeczytanych tematów"},"topic_count_new":{"one":"Zobacz {{count}} nowy temat","few":"Zobacz {{count}} nowe tematy","many":"Zobacz {{count}} nowych tematów","other":"Zobacz {{count}} nowych tematów"},"preview":"podgląd","cancel":"anuluj","save":"Zapisz zmiany","saving":"Zapisuję…","saved":"Zapisano!","upload":"Dodaj","uploading":"Wysyłam…","uploading_filename":"Wysyłanie: {{filename}}","clipboard":"schowek","uploaded":"Wgrano!","pasting":"Wklejanie...","enable":"Włącz","disable":"Wyłącz","continue":"Kontynuuj","undo":"Cofnij","revert":"Przywróć","failed":"Niepowodzenie","switch_to_anon":"Włącz tryb anonimowy","switch_from_anon":"Zakończ tryb anonimowy","banner":{"close":"Zamknij ten baner.","edit":"Edytuj ten baner \u003e\u003e"},"pwa":{"install_banner":"Czy chcesz \u003ca href\u003ezainstalować %{title} na tym urządzeniu?\u003c/a\u003e"},"choose_topic":{"none_found":"Nie znaleziono tematów.","title":{"search":"Wyszukaj temat","placeholder":"wpisz tytuł tematu, adres URL lub identyfikator tutaj"}},"choose_message":{"none_found":"Nie znaleziono wiadomości.","title":{"search":"Wyszukaj wiadomość","placeholder":"wpisz tutaj tytuł wiadomości, adres URL lub identyfikator"}},"review":{"order_by":"Segreguj według:","in_reply_to":"w odpowiedzi na","explain":{"why":"wyjaśnij, dlaczego ten element znalazł się w kolejce","title":"Przeglądalna ocena","formula":"Formuła","subtotal":"Suma częściowa","total":"Łącznie","min_score_visibility":"Minimalny wynik dla widoczności","score_to_hide":"Wynik do ukrycia postu","take_action_bonus":{"name":"Podjęto działanie","title":"Gdy członek personelu zdecyduje się na działanie, flaga otrzymuje premię."},"user_accuracy_bonus":{"name":"celność użytkownika","title":"Użytkownicy, których flagi były wcześniej uzgodnione, otrzymują bonus."},"trust_level_bonus":{"name":"Poziom Zaufania","title":"Przedmioty, które można przeglądać, tworzone przez użytkowników o wyższym poziomie zaufania, mają wyższy wynik."},"type_bonus":{"name":"bonus typu","title":"Niektóre rodzaje przeglądalne mogą otrzymać premię od pracowników, aby nadać im wyższy priorytet."}},"claim_help":{"optional":"Możesz zgłosić roszczenie do tego elementu, aby uniemożliwić innym jego sprawdzenie.","required":"Musisz przejąć tę pozycję, zanim będziesz mógł je przejrzeć.","claimed_by_you":"Przejąłeś tę pozycję i możesz ją teraz przejrzeć.","claimed_by_other":"Ten przedmiot może być sprawdzony tylko przez \u003cb\u003e{{username}}\u003c/b\u003e ."},"claim":{"title":"zgłoś ten temat"},"unclaim":{"help":"usuń to roszczenie"},"awaiting_approval":"Oczekuje na zatwierdzenie","delete":"Usuń","settings":{"saved":"Zapisano","save_changes":"Zapisz zmiany","title":"Ustawienia","priorities":{"title":"Przeglądalne priorytety"}},"moderation_history":"Historia moderacji","view_all":"Pokaż wszystko","grouped_by_topic":"Grupuj tematycznie","none":"Brak elementów do przejrzenia.","view_pending":"pokaż oczekujące","topic_has_pending":{"one":"W tym temacie jest \u003cb\u003e%{count}\u003c/b\u003e po zatwierdzeniu","few":"W tym temacie jest \u003cb\u003e{{count}}\u003c/b\u003e postów oczekujących na zatwierdzenie","many":"W tym temacie jest \u003cb\u003e{{count}}\u003c/b\u003e postów oczekujących na zatwierdzenie","other":"W tym temacie jest \u003cb\u003e{{count}}\u003c/b\u003e postów oczekujących na zatwierdzenie"},"title":"Sprawdź","topic":"Temat:","filtered_topic":"Przefiltrowałeś do przeglądalnej zawartości w jednym temacie.","filtered_user":"Użytkownik","show_all_topics":"pokaż wszystkie tematy","deleted_post":"(wpis usunięty)","deleted_user":"(użytkownik usunięty)","user":{"bio":"Biografia","website":"Stronie internetowej","username":"Nazwa użytkownika","email":"Email","name":"Imię","fields":"Pola"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} flaga ogółem)","few":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} flagi ogółem)","many":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} flagi ogółem)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} flagi ogółem)"},"agreed":{"one":"{{count}}% zgadza się","few":"{{count}}% zgadza się","many":"{{count}}% zgadza się","other":"{{count}}% zgadza się"},"disagreed":{"one":"{{count}}% nie zgadza się ","few":"{{count}}% nie zgadza się ","many":"{{count}}% nie zgadza się ","other":"{{count}}% nie zgadza się "},"ignored":{"one":"{{count}}% zignorowało","few":"{{count}}% zignorowało","many":"{{count}}% zignorowało","other":"{{count}}% zignorowało"}},"topics":{"topic":"Temat","reviewable_count":"Liczba","reported_by":"Zgłoszony przez","deleted":"[Temat usunięty]","original":"(oryginalny temat)","details":"szczegóły","unique_users":{"one":"%{count} użytkownik","few":"{{count}} użytkowników","many":"{{count}}użytkowników","other":"{{count}} użytkowników"}},"replies":{"one":"%{count} odpowiedź","few":"{{count}} odpowiedzi","many":"{{count}} odpowiedzi","other":"{{count}} odpowiedzi"},"edit":"Edytuj","save":"Zapisz","cancel":"Anuluj","new_topic":"Zatwierdzenie tego elementu stworzy nowy temat","filters":{"all_categories":"(wszystkie kategorie)","type":{"title":"Typ","all":"(wszystkie typy)"},"minimum_score":"Minimalny wynik:","refresh":"Odśwież","status":"Status","category":"Kategoria","orders":{"priority":"Priorytet","priority_asc":"Priorytet (odwróć)","created_at":"Utworzony","created_at_asc":"Utworzono (odwrotnie)"},"priority":{"title":"Minimalny priorytet","low":"(dowolny)","medium":"Średni","high":"Wysoki"}},"conversation":{"view_full":"zobacz całą rozmowę"},"scores":{"about":"Wynik jest obliczany na podstawie poziomu zaufania raportującego, akceptacji poprzednich flag i priorytetu raportowanego wpisu.","score":"Wynik","date":"Data","type":"Typ","status":"Status","submitted_by":"Wysłany przez","reviewed_by":"Sprawdzony przez"},"statuses":{"pending":{"title":"Oczekujące"},"approved":{"title":"Zaakceptowany"},"rejected":{"title":"Odrzucone"},"ignored":{"title":"Zignorowany"},"deleted":{"title":"Usunięty"},"reviewed":{"title":"(wszystkie sprawdzone)"},"all":{"title":"(wszystko)"}},"types":{"reviewable_flagged_post":{"title":"Oflagowany wpis","flagged_by":"Oflagowany przez"},"reviewable_queued_topic":{"title":"Temat w kolejce"},"reviewable_queued_post":{"title":"Wpis w kolejce"},"reviewable_user":{"title":"Użytkownik"}},"approval":{"title":"Wpis wymaga zatwierdzenia","description":"Twój nowy wpis został umieszczony w kolejce i pojawi się po zatwierdzeniu przez moderatora. Prosimy o cierpliwość.","pending_posts":{"one":"Masz \u003cstrong\u003e%{count}\u003c/strong\u003e post w toku.","few":"Masz oczekujących \u003cstrong\u003e{{count}}\u003c/strong\u003e postów.","many":"Masz oczekujących \u003cstrong\u003e{{count}}\u003c/strong\u003e postów.","other":"Masz oczekujących \u003cstrong\u003e{{count}}\u003c/strong\u003e postów."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tworzy \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDodajesz\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpowiada na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eOdpowiadasz\u003c/a\u003e na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpisuje na \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eOdpowiadasz\u003c/a\u003e w \u003ca href='{{topicUrl}}'\u003etemacie\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e wspomina o \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e wspomniał o \u003ca href='{{user2Url}}'\u003etobie\u003c/a\u003e","you_mentioned_user":"\u003ca href=\"{{user1Url}}\"\u003eWspomniałeś/aś\u003c/a\u003e o użytkowniku \u003ca href=\"{{user2Url}}\"\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Wysłane przez \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Dodany przez \u003ca href='{{userUrl}}'\u003eciebie\u003c/a\u003e","sent_by_user":"Wysłano przez \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Wysłano przez \u003ca href='{{userUrl}}'\u003eCiebie\u003c/a\u003e"},"directory":{"filter_name":"sortuj po nazwie użytkownika","title":"Użytkownicy","likes_given":"Oddane","likes_received":"Otrzymane","topics_entered":"Odsłony","topics_entered_long":"Wyświetlone Tematy","time_read":"Czas","topic_count":"Tematy","topic_count_long":"Utworzone tematy","post_count":"Odpowiedzi","post_count_long":"Wysłane odpowiedzi","no_results":"Nie znaleziono wyników.","days_visited":"Odwiedziny","days_visited_long":"Dni Odwiedzin","posts_read":"Przeczytane","posts_read_long":"Przeczytane wpisy","last_updated":"Ostatnio zaktualizowany:","total_rows":{"one":"%{count} użytkownik","few":"%{count} użytkownicy","many":"%{count} użytkowników","other":"%{count} użytkowników"}},"group_histories":{"actions":{"change_group_setting":"Zmień ustawienia grupy","add_user_to_group":"Dodaj użytkownika","remove_user_from_group":"Usuń użytkownika","make_user_group_owner":"Nadaj prawa właściciela","remove_user_as_group_owner":"Usuń prawa właściciela"}},"groups":{"member_added":"Dodano","member_requested":"Poproszono o","add_members":{"title":"Dodaj członków","description":"Zarządzaj członkami tej grupy","usernames":"Nazwy użytkowników"},"requests":{"title":"Prośby","reason":"Powód","accept":"Zaakceptuj","accepted":"przyjęty","deny":"Odrzuć","denied":"odrzucony","undone":"prośba cofnięta","handle":"obsłuż prośby o członkostwo "},"manage":{"title":"Zarządzaj","name":"Nazwa","full_name":"Pełna nazwa","add_members":"Dodaj członków","delete_member_confirm":"Usunąć '%{username}' z grupy '%{group}'?","profile":{"title":"Profil"},"interaction":{"title":"Interakcja","posting":"Wysyłanie","notification":"Powiadomienie"},"membership":{"title":"Członkostwo","access":"Dostęp"},"logs":{"title":"Logi","when":"Kiedy","action":"Akcja","acting_user":"Użytkownik odpowiedzialny","target_user":"Wskazany użytkownik","subject":"Temat","details":"Szczegóły","from":"Od","to":"Do"}},"public_admission":"Zezwól wszystkim użytkownikom na dołączanie do tej grupy (widoczność grupy musi być ustawiona na publiczną)","public_exit":"Zezwól wszystkim użytkownikom na opuszczanie tej grupy","empty":{"posts":"Członkowie tej grupy nie opublikowali żadnych postów.","members":"Nie ma użytkowników w tej grupie","requests":"Są prośby o dołączenie do tej grupy.","mentions":"Nie ma wspomnień tej grupy","messages":"Nie ma wiadomości dla tej grupy","topics":"Nie ma wątków stworzonych przez użytkowników tej grupy","logs":"Nie ma logów dla tej grupy"},"add":"Dodaj","join":"Dołącz","leave":"Opuść","request":"Wniosek","message":"Wiadomość","confirm_leave":"Czy na pewno chcesz opuścić tę grupę?","allow_membership_requests":"Zezwalaj użytkownikom na wysyłanie wniosków o członkostwo do właścicieli grup (wymaga publicznie widocznej grupy)","membership_request_template":"Wyświetl niestandardowy szablon użytkownikom, w momencie wysyłania wniosku o członkostwo.","membership_request":{"submit":"Złóż wniosek","title":"Prośba o dołączenie @%{group_name}","reason":"Poinformuj właścicieli grupy dlaczego do niej należysz."},"membership":"Członkostwo","name":"Nazwa","group_name":"Nazwa grupy","user_count":"Użytkownicy","bio":"O grupie","selector_placeholder":"podaj nazwę użytkownika","owner":"właściciel","index":{"title":"Grupy","all":"Wszystkie grupy","empty":"Nie ma widocznych grup","filter":"Filtruj według typu grupy","owner_groups":"Moje grupy","close_groups":"Zamknięte grupy","automatic_groups":"Grupy automatyczne","automatic":"Automatyczne","closed":"Zamknięta","public":"Publiczna","private":"Prywatna","public_groups":"Publiczne grupy","automatic_group":"Grupa automatyczna","close_group":"Zamknij grupę","my_groups":"Moje grupy","group_type":"Rodzaj grupy","is_group_user":"Członek","is_group_owner":"Właściciel"},"title":{"one":"Grupa","few":"Grupy","many":"Grup","other":"Grup"},"activity":"Aktywność","members":{"title":"Członkowie","filter_placeholder_admin":"nazwa użytkownika lub adres e-mail","filter_placeholder":"nazwa użytkownika","remove_member":"Usuń członka","remove_member_description":"Usuń \u003cb\u003e%{username}\u003c/b\u003e z tej grupy","make_owner":"Uczyń właścicielem","make_owner_description":"Uczyń \u003cb\u003e%{username}\u003c/b\u003e właścicielem tej grupy","remove_owner":"Usuń z funkcji właściciela","remove_owner_description":"Usuń \u003cb\u003e%{username}\u003c/b\u003e z funkcji właściciela tej grupy","owner":"Właściciel","forbidden":"Nie możesz oglądać profili użytkowników."},"topics":"Tematy","posts":"Wpisów","mentions":"Wzmianki","messages":"Wiadomości","notification_level":"Domyślny poziom powiadomień dla wiadomości grupy.","alias_levels":{"mentionable":"Kto może @wspomnieć tę grupę?","messageable":"Kto może wysyłać wiadomości do tej grupy?","nobody":"Nikt","only_admins":"Tylko administratorzy","mods_and_admins":"Tylko moderatorzy i administratorzy","members_mods_and_admins":"Tylko członkowie grupy, moderatorzy i administratorzy","owners_mods_and_admins":"Tylko właściciele, moderatorzy i administratorzy grup","everyone":"Wszyscy"},"notifications":{"watching":{"title":"Obserwowanie","description":"Dostaniesz powiadomienie o każdym nowym wpisie w każdej dyskusji, zobaczysz również ilość odpowiedzi."},"watching_first_post":{"title":"Oglądasz pierwszy post","description":"Zostaniesz poinformowany o nowych wiadomościach w tej grupie, ale nie odpowiedziach do wiadomości."},"tracking":{"title":"Śledzenie","description":"Dostaniesz powiadomienie, gdy ktoś ci odpowie lub wspomni twoją @nazwę, zobaczysz również liczbę odpowiedzi."},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie, gdy ktoś ci odpowie lub wspomni twoją @nazwę."},"muted":{"title":"Wyciszony","description":"Nie dostaniesz powiadomień na temat wiadomości w tej grupie."}},"flair_url":"Awatar ","flair_url_placeholder":"(Opcjonalne) Link do obrazka lub klasa Font Awesome","flair_url_description":"Użyj kwadratowego obrazka mniejszego niż 20px na 20px lub ikony FontAwesome (akceptowane formaty: \"fa-icon\", \"far fa-icon\" i \"fab fa-icon\").","flair_bg_color":"Kolor tła odznaki grupowej","flair_bg_color_placeholder":"(Opcjonalne) Kolor w formacie Hex","flair_color":"Kolor odznaki grupowej ","flair_color_placeholder":"(Opcjonalne) Kolor w formacie Hex","flair_preview_icon":"Podgląd ikony","flair_preview_image":"Podgląd obrazka"},"user_action_groups":{"1":"Przyznane lajki","2":"Otrzymane lajki","3":"Zakładki","4":"Tematy","5":"Odpowiedzi","6":"Odpowiedzi","7":"Wzmianki","9":"Cytaty","11":"Edycje","12":"Wysłane","13":"Skrzynka odbiorcza","14":"Oczekujące","15":"Szkice"},"categories":{"all":"wszystkie kategorie","all_subcategories":"wszystkie","no_subcategory":"żadne","category":"Kategoria","category_list":"Wyświetl listę kategorii","reorder":{"title":"Zmień kolejność kategorii","title_long":"Zmień kolejność listy kategorii","save":"Zapisz kolejność","apply_all":"Zastosuj","position":"Pozycja"},"posts":"Wpisy","topics":"Tematy","latest":"Aktualne","latest_by":"najnowszy wpis: ","toggle_ordering":"przełącz kolejność kontroli","subcategories":"Podkategorie","topic_sentence":{"one":"%{count} temat","few":"Kilka tematów","many":"%{count} tematów","other":"%{count} tematów"},"topic_stat_sentence_week":{"one":"%{count}nowy temat w zeszłym miesiącu.","few":"%{count}nowe tematy w zeszłym tygodniu.","many":"%{count}nowych tematów w zeszłym tygodniu.","other":"%{count}nowych tematów w zeszłym tygodniu."},"topic_stat_sentence_month":{"one":"%{count} nowy temat w ostatnim miesiącu.","few":"%{count} nowe tematy w ostatnim miesiącu.","many":"%{count} nowe tematy w ostatnim miesiącu.","other":"%{count} nowych tematów w ostatnim miesiącu."},"n_more":"Kategorie (%{count} więcej) …"},"ip_lookup":{"title":"Wyszukiwanie adresu IP","hostname":"Nazwa hosta","location":"Lokalizacja","location_not_found":"(nieznane)","organisation":"Organizacja","phone":"Numer telefonu","other_accounts":"Inne konta z tym adresem IP:","delete_other_accounts":"Usuń %{count}","username":"nazwa użytkownika","trust_level":"TL","read_time":"czas czytania:","topics_entered":"wprowadzone tematy:","post_count":"# wpisów","confirm_delete_other_accounts":"Czy na pewno chcesz usunąć wybrane konta?","powered_by":"używa \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"skopiowano"},"user_fields":{"none":"(wybierz opcję)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Wycisz","edit":"Edytuj ustawienia","download_archive":{"button_text":"Pobierz Wszystko","confirm":"Czy na pewno chcesz pobrać swoje wszystkie wpisy?","success":"Rozpoczęto eksport: otrzymasz wiadomość, gdy proces zostanie zakończony.","rate_limit_error":"Wpisy mogą być pobierane raz dziennie, spróbuj ponownie jutro."},"new_private_message":"Nowa wiadomość","private_message":"Wiadomość","private_messages":"Wiadomości","user_notifications":{"ignore_duration_title":"Ignoruj licznik","ignore_duration_username":"Nazwa użytkownika","ignore_duration_when":"Oczekiwanie","ignore_duration_save":"Ignoruj","ignore_duration_note":"Pamiętaj, że wszystkie ignorowania są automatycznie usuwane po upływie czasu ignorowania.","ignore_duration_time_frame_required":"Wybierz przedział czasowy","ignore_no_users":"Nie posiadasz ignorowanych użytkowników.","ignore_option":"Zignorowany","ignore_option_title":"Nie będziesz otrzymywać powiadomień związanych z tym użytkownikiem, a wszystkie ich tematy i odpowiedzi będą ukryte.","add_ignored_user":"Dodaj...","mute_option":"Wyciszenie","mute_option_title":"Nie będziesz otrzymywać żadnych powiadomień związanych z tym użytkownikiem.","normal_option":"Normalny","normal_option_title":"Zostaniesz powiadomiony, jeśli ten użytkownik odpowie ci, zacytuje lub o tobie wspomni."},"activity_stream":"Aktywność","preferences":"Ustawienia","feature_topic_on_profile":{"open_search":"Wybierz nowy temat","title":"Wybierz temat","search_label":"Wyszukaj temat według tytułu","save":"Zapisz","clear":{"title":"Wyczyść","warning":"Czy na pewno chcesz wyczyścić polecany temat?"}},"use_current_timezone":"Użyj aktualnej strefy czasowej","profile_hidden":"Publiczny profil użytkownika jest ukryty.","expand_profile":"Rozwiń","collapse_profile":"Zwiń","bookmarks":"Zakładki","bio":"O mnie","timezone":"Strefa czasowa","invited_by":"Zaproszono przez","trust_level":"Poziom zaufania","notifications":"Powiadomienia","statistics":"Statystyki","desktop_notifications":{"label":"Natychmiastowe powiadomienia","not_supported":"Powiadomienia nie są wspierane przez tę przeglądarkę. Przepraszamy.","perm_default":"Włącz powiadomienia","perm_denied_btn":"Brak uprawnień","perm_denied_expl":"Odmówiłeś dostępu dla powiadomień. Pozwól na powiadomienia w ustawieniach przeglądarki.","disable":"Wyłącz powiadomienia","enable":"Włącz powiadomienia","each_browser_note":"Uwaga: to ustawienie musisz zmienić w każdej przeglądarce której używasz.","consent_prompt":"Czy chcesz otrzymywać natychmiastowe powiadomienia, gdy ktoś odpowie na twój post?"},"dismiss":"Odrzuć","dismiss_notifications":"Odrzuć wszystkie","dismiss_notifications_tooltip":"Oznacz wszystkie powiadomienia jako przeczytane","first_notification":"Twoje pierwsze powiadomienie! Kliknij aby zacząć.","dynamic_favicon":"Pokazuj liczbę nowych/zaktualizowanych tematów w ikonie przeglądarki.","theme_default_on_all_devices":"Ustaw to jako domyślny motyw na wszystkich urządzeniach","text_size_default_on_all_devices":"Ustaw ten domyślny rozmiar tekstu na wszystkich urządzeniach","allow_private_messages":"Pozwól innym użytkownikom wysyłać do mnie prywatne wiadomości","external_links_in_new_tab":"Otwieraj wszystkie zewnętrzne odnośniki w nowej karcie","enable_quoting":"Włącz cytowanie zaznaczonego tekstu","enable_defer":"Włącz odroczenie, aby oznaczyć tematy jako nieprzeczytane","change":"zmień","featured_topic":"Wyróżniony temat","moderator":"{{user}} jest moderatorem","admin":"{{user}} jest adminem","moderator_tooltip":"Ten użytkownik jest moderatorem","admin_tooltip":"Ten użytkownik jest administratorem","silenced_tooltip":"Ten użytkownik jest wyciszony","suspended_notice":"ten użytkownik jest zawieszony do {{date}}.","suspended_permanently":"Ten użytkownik jest zawieszony","suspended_reason":"Powód: ","github_profile":"Github","email_activity_summary":"Podsumowanie aktywności","mailing_list_mode":{"label":"Tryb listy mailingowej","enabled":"Włącz tryb listy mailingowej","instructions":"To ustawienie nadpisuje podsumowanie aktywności. \u003cbr /\u003e\n","individual":"Wyślij e-mail dla każdego nowego postu","individual_no_echo":"Wysyłaj emaile dla każdego nowego postu oprócz mojego","many_per_day":"Wyślij mi e-mail dla każdego nowego posta (około {{dailyEmailEstimate}} na dzień)","few_per_day":"Wyślij mi e-mail dla każdego nowego posta (około 2 dziennie)","warning":"Tryb listy mailingowej włączony. Ustawienia powiadomień e-mail są zastępowane."},"tag_settings":"Tagi","watched_tags":"Obserwowane","watched_tags_instructions":"Będziesz automatycznie śledzić wszystkie nowe tematy z tymi tagami, będziesz otrzymywać powiadomienie o każdym nowym wpisie i temacie, a liczba nieprzeczytanych i nowych wpisów będzie wyświetlana obok tytułów na liście tematów. ","tracked_tags":"Śledzone","tracked_tags_instructions":"Będziesz automatycznie śledzić wszystkie nowe tematy z tymi tagami. Licznik nowych wpisów pojawi się obok tytułu na liście tematów.","muted_tags":"Wyciszone","muted_tags_instructions":"Nie będziesz powiadamiany o niczym dotyczącym nowych tematów z tymi tagami i nie pojawią się na liście aktualnych.","watched_categories":"Obserwowane","watched_categories_instructions":"Będziesz automatycznie śledzić wszystkie nowe tematy w tych kategoriach. Będziesz otrzymywać powiadomienie o każdym nowym wpisie i temacie, a liczba nowych wpisów będzie wyświetlana obok tytułów na liście tematów. ","tracked_categories":"Śledzone","tracked_categories_instructions":"Będziesz automatycznie śledzić wszystkie tematy w tych kategoriach. Licznik nowych wpisów pojawi się obok tytułu na liście tematów.","watched_first_post_categories":"Oglądasz pierwszy post","watched_first_post_categories_instructions":"Zostaniesz powiadomiony o pierwszym wpisie w każdym nowym temacie w tych kategoriach.","watched_first_post_tags":"Oglądasz pierwszy post","watched_first_post_tags_instructions":"Zostaniesz powiadomiony tylko o pierwszym wpisie w każdym nowym temacie oznaczonym tymi tagami.","muted_categories":"Wyciszone","muted_categories_instructions":"Nie będziesz powiadamiany o nowych tematach w tych kategoriach. Nie pojawią się na liście nieprzeczytanych.","muted_categories_instructions_dont_hide":"Nie otrzymasz powiadomień o nowych tematach w tych kategoriach. ","no_category_access":"Jako moderator masz limitowany dostęp do kategorii, możliwość zapisu jest wyłączona.","delete_account":"Usuń moje konto","delete_account_confirm":"Czy na pewno chcesz usunąć swoje konto? To nieodwracalne!","deleted_yourself":"Twoje konto zostało usunięte.","delete_yourself_not_allowed":"Skontaktuj się z członkiem zespołu jeśli chcesz, aby twoje konto zostało usunięte.","unread_message_count":"Wiadomości","admin_delete":"Usuń","users":"Użytkownicy","muted_users":"Uciszeni","muted_users_instructions":"Wstrzymaj powiadomienia od tych użytkowników.","ignored_users":"Zignorowany","ignored_users_instructions":"Wstrzymaj wszystkie posty i powiadomienia od tych użytkowników.","tracked_topics_link":"Pokaż","automatically_unpin_topics":"Automatycznie odpinaj tematy kiedy dotrę do końca strony.","apps":"Aplikacje","revoke_access":"Zablokuj dostęp","undo_revoke_access":"Cofnij zablokowanie dostępu","api_approved":"Zatwierdzony:","api_last_used_at":"Ostatnio użyto:","theme":"Motyw","home":"Domyślna strona domowa","staged":"Wystawiany na scenie","staff_counters":{"flags_given":"uczynnych oflagowań","flagged_posts":"oflagowane wpisy","deleted_posts":"usunięte wpisy","suspensions":"zawieszone","warnings_received":"otrzymanych ostrzeżeń","rejected_posts":"odrzucone posty"},"messages":{"all":"Wszystkie","inbox":"Skrzynka odbiorcza","sent":"Wysłane","archive":"Archiwum","groups":"Moje grupy","bulk_select":"Zaznacz wiadomości","move_to_inbox":"Przenieś do skrzynki odbiorczej","move_to_archive":"Archiwum","failed_to_move":"Nie udało się przenieść zaznaczonych wiadomości (prawdopodobnie wystąpił problem z Twoim połączeniem)","select_all":"Zaznacz wszystko","tags":"Tagi"},"preferences_nav":{"account":"Konto","profile":"Profil","emails":"Wiadomości","notifications":"Powiadomienia","categories":"Kategorie","users":"Użytkownicy","tags":"Tagi","interface":"Interfejs","apps":"Aplikacje"},"change_password":{"success":"(email wysłany)","in_progress":"(email wysyłany)","error":"(błąd)","action":"Wyślij wiadomość email resetującą hasło","set_password":"Ustaw hasło","choose_new":"Wyberz nowe hasło","choose":"Wybierz hasło"},"second_factor_backup":{"title":"Kod zapasowy weryfikacji dwuskładnikowej","regenerate":"Odnów","disable":"Wyłącz","enable":"Włącz","enable_long":"Włącz kody zapasowe","manage":"Zarządzaj kodami zapasowymi. Pozostały Ci kody zapasowe \u003cstrong\u003e{{count}}\u003c/strong\u003e .","copied_to_clipboard":"Skopiowane do schowka","copy_to_clipboard_error":"Wystąpił błąd w trakcie kopiowania do schowka","remaining_codes":"Pozostały Ci kody zapasowe \u003cstrong\u003e{{count}}\u003c/strong\u003e .","use":"Używaj kodu zapasowego","enable_prerequisites":"Przed wygenerowaniem kodów zapasowych należy włączyć główny drugi czynnik.","codes":{"title":"Wygenerowano kody zapasowe","description":"Każdy z tych kodów zapasowych można użyć tylko raz. Trzymaj je w bezpiecznym, ale dostępnym miejscu."}},"second_factor":{"title":"Dwuskładnikowe uwierzytelnianie","enable":"Zarządzaj autentykacją dwuetapową","forgot_password":"Zapomniałeś hasła?","confirm_password_description":"Potwierdź swoje hasło, aby kontynuować","name":"Imię","label":"Kod","rate_limit":"Poczekaj, zanim spróbujesz użyć innego kodu uwierzytelniającego.","enable_description":"Zeskanuj ten kod QR w obsługiwanej aplikacji ( \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e - \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e ) i wprowadź kod uwierzytelniający\n","disable_description":"Podaj kod uwierzytelniający ze swojej aplikacji","show_key_description":"Wpisz ręcznie","short_description":"Chroń swoje konto za pomocą jednorazowych kodów bezpieczeństwa.\n","oauth_enabled_warning":"Pamiętaj, że loginy społecznościowe zostaną wyłączone po włączeniu uwierzytelniania dwuskładnikowego na Twoim koncie.","use":"Użyj aplikacji Authenticator","enforced_notice":"Aby uzyskać dostęp do tej witryny, musisz włączyć uwierzytelnianie dwuskładnikowe.","disable":"Wyłącz","disable_title":"Wyłącz drugi czynnik","disable_confirm":"Czy na pewno chcesz wyłączyć wszystkie drugie czynniki?","edit":"Edytuj","edit_title":"Edytuj drugi czynnik","edit_description":"Nazwa drugiego czynnika","enable_security_key_description":"Po przygotowaniu fizycznego klucza bezpieczeństwa naciśnij przycisk Zarejestruj poniżej.","totp":{"title":"Uwierzytelnianie oparte na tokenach","add":"Nowy Authenticator","default_name":"Mój Authenticator","name_and_code_required_error":"Musisz podać nazwę i kod z aplikacji uwierzytelniającej."},"security_key":{"register":"Zarejestruj","title":"Klucze bezpieczeństwa","add":"Zarejestruj klucz bezpieczeństwa","default_name":"Główny klucz bezpieczeństwa","not_allowed_error":"Upłynął limit czasu procesu rejestracji klucza bezpieczeństwa lub został on anulowany.","already_added_error":"Ten klucz bezpieczeństwa został już zarejestrowany. Nie musisz go ponownie rejestrować.","edit":"Edytuj Klucz Bezpieczeństwa","edit_description":"Nazwa klucza bezpieczeństwa","delete":"Usuń","name_required_error":"Musisz podać nazwę swojego klucza bezpieczeństwa."}},"change_about":{"title":"Zmień O mnie","error":"Wystąpił błąd podczas zmiany tej wartości."},"change_username":{"title":"Zmień nazwę użytkownika","confirm":"Czy jesteś absolutnie pewien że chcesz zmienić swoją nazwę użytkownika?","taken":"Przykro nam, ale ta nazwa jest zajęta.","invalid":"Ta nazwa jest niepoprawna. Powinna zawierać jedynie liczby i litery."},"change_email":{"title":"Zmień adres email","taken":"Przykro nam, ale ten adres email nie jest dostępny.","error":"Wystąpił błąd podczas próby zmiany twojego adresu email. Być może ten email jest już zarejestrowany?","success":"Wysłaliśmy wiadomość do potwierdzenia na podany adres email.","success_staff":"Wysłaliśmy wiadomość na bieżący adres. Proszę przestrzegać informacji dotyczących potwierdzenia adresu."},"change_avatar":{"title":"Zmień swój awatar","gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e , na podstawie","gravatar_title":"Zmień swój awatar na stronie {{gravatarName}}","gravatar_failed":"Nie mogliśmy znaleźć {{gravatarName}} z tym adresem e-mail.","refresh_gravatar_title":"Odśwież swój {{gravatarName}}","letter_based":"Awatar przyznany przez system","uploaded_avatar":"Zwyczajny obrazek","uploaded_avatar_empty":"Dodaj zwyczajny obrazek","upload_title":"Wyślij swoją grafikę","image_is_not_a_square":"Uwaga: grafika została przycięta ponieważ jej wysokość i szerokość nie były równe. "},"change_profile_background":{"title":"Nagłówek profilu","instructions":"Nagłówki profilu zostaną wyśrodkowane i będą miały domyślną szerokość 1110 pikseli."},"change_card_background":{"title":"Tło karty użytkownika","instructions":"Tło karty użytkownika est wycentrowane i posiada domyślną szerokość 590px."},"change_featured_topic":{"title":"Wyróżniony temat","instructions":"Link do tego tematu będzie na twojej karcie użytkownika i profilu."},"email":{"title":"Email","primary":"Podstawowy adres email","secondary":"Drugorzędne adresy email","no_secondary":"Brak drugorzędnych adresów email","sso_override_instructions":"E-mail można zaktualizować od dostawcy SSO.","instructions":"Nie będzie publicznie widoczny.","ok":"Otrzymasz potwierdzenie emailem","invalid":"Podaj poprawny adres email","authenticated":"Twój email został potwierdzony przez {{provider}}","frequency_immediately":"Wyślemy powiadomienie jeśli wskazana rzecz nie została jeszcze przez Ciebie przeczytana.","frequency":{"one":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatniej minuty.","few":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatnich {{count}} minut.","many":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatnich {{count}} minut.","other":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatnich {{count}} minut."}},"associated_accounts":{"title":"Powiązane konta","connect":"Połącz","revoke":"Unieważnij","cancel":"Anuluj","not_connected":"(nie połączony)","confirm_modal_title":"Połącz konto %{provider}","confirm_description":{"account_specific":"Twoje konto %{provider} „%{account_description}” zostanie użyte do uwierzytelnienia.","generic":"Twoje konto %{provider} zostanie wykorzystane do uwierzytelnienia."}},"name":{"title":"Pełna nazwa","instructions":"twoja pełna nazwa (opcjonalnie)","instructions_required":"Twoja pełna nazwa","too_short":"Twoja nazwa jest zbyt krótka","ok":"Twoja nazwa jest ok"},"username":{"title":"Nazwa konta","instructions":"unikalna, bez spacji, krótka","short_instructions":"Inni mogą o tobie wspomnieć pisząc @{{username}}","available":"Nazwa użytkownika jest dostępna","not_available":"Niedostępna. Może spróbuj {{suggestion}}?","not_available_no_suggestion":"Niedostępne","too_short":"Nazwa użytkownika jest zbyt krótka","too_long":"Nazwa użytkownika jest zbyt długa","checking":"Sprawdzanie, czy nazwa jest dostępna…","prefilled":"Email zgadza się z zarejestrowaną nazwą użytkownika"},"locale":{"title":"Język interfejsu","instructions":"Język interfejsu użytkownika. Zmieni się, gdy odświeżysz stronę.","default":"(domyślny)","any":"każdy"},"password_confirmation":{"title":"Powtórz hasło"},"invite_code":{"title":"Zaproś kod","instructions":"Rejestracja konta wymaga kodu zaproszenia"},"auth_tokens":{"title":"Ostatnio używane urządzenia","ip":"IP","details":"Detale","log_out_all":"Wyloguj się wszędzie","active":"teraz aktywna","not_you":"To nie ty?","show_all":"Pokaż wszystko ({{count}})","show_few":"Pokaż mniej","was_this_you":"To byłes Ty?","was_this_you_description":"Jeśli to nie ty, zalecamy zmianę hasła i wylogowanie się ze wszystkich urządzeń.","browser_and_device":"{{browser}} na {{device}}","secure_account":"Zabezpiecz moje konto","latest_post":"Twój ostatni wpis ..."},"last_posted":"Ostatni wpis","last_emailed":"Ostatnio otrzymał email","last_seen":"Ostatnio widziano","created":"Dołączył","log_out":"Wyloguj","location":"Lokalizacja","website":"Strona internetowa","email_settings":"Email","hide_profile_and_presence":"Ukryj mój profil publiczny i funkcje obecności","enable_physical_keyboard":"Włącz obsługę klawiatury fizycznej na iPadzie","text_size":{"title":"Rozmiar tekstu","smaller":"Mniejszy","normal":"Normalny","larger":"Większy","largest":"Największy"},"title_count_mode":{"title":"Tytuł strony w tle wyświetla liczbę:","notifications":"Nowe powiadomienia","contextual":"Nowa zawartość strony"},"like_notification_frequency":{"title":"Powiadom o lajkach","always":"Zawsze","first_time_and_daily":"Pierwszy lajk i raz dziennie","first_time":"Pierwszy lajk","never":"Nigdy"},"email_previous_replies":{"title":"Dołącz poprzednie odpowiedzi na końcu e-maili.","unless_emailed":"chyba wcześniej wysłany","always":"zawsze","never":"nigdy"},"email_digests":{"title":"Gdy nie odwiedzam strony, wysyłaj e-mail podsumowujący z popularnymi tematami i odpowiedziami.","every_30_minutes":"co 30 minut","every_hour":"co godzinę","daily":"codziennie","weekly":"co tydzień","every_month":"każdego miesiąca","every_six_months":"co 6 miesięcy"},"email_level":{"title":"Wysyłaj e-mail gdy ktoś mnie cytuje, odpowiada na mój wpis, wywołuje moją @nazwę lub zaprasza mnie do tematu.","always":"zawsze","only_when_away":"tylko kiedy jest daleko","never":"nigdy"},"email_messages_level":"Wyślij e-mail, gdy ktoś napisze mi prywatną wiadomość","include_tl0_in_digests":"Dołącz treści od nowych użytkowników w e-mailach podsumowujących.","email_in_reply_to":"Dołącz fragment odpowiedzi w poście do maili ","other_settings":"Inne","categories_settings":"Kategorie","new_topic_duration":{"label":"Uznaj, że temat jest nowy, jeśli","not_viewed":"niewidziane ","last_here":"dodane od ostatniej wizyty","after_1_day":"utworzone w ciągu ostatniego dnia","after_2_days":"utworzone w ciągu ostatnich 2 dni","after_1_week":"utworzone w ostatnim tygodniu","after_2_weeks":"utworzone w ostatnich 2 tygodniach"},"auto_track_topics":"Automatycznie śledź tematy które odwiedzę","auto_track_options":{"never":"nigdy","immediately":"natychmiast","after_30_seconds":"po 30 sekundach","after_1_minute":"po 1 minucie","after_2_minutes":"po 2 minutach","after_3_minutes":"po 3 minutach","after_4_minutes":"po 4 minutach","after_5_minutes":"po 5 minutach","after_10_minutes":"po 10 minutach"},"notification_level_when_replying":"Kiedy piszę w temacie, dołącz ten temat do","invited":{"search":"wpisz aby szukać zaproszeń…","title":"Zaproszenia","user":"Zaproszony(-a) użytkownik(-czka)","sent":"Ostatni wysłany","none":"Brak zaproszeń do wyświetlenia.","truncated":{"one":"Wyświetlanie pierwszego zaproszenia.","few":"Wyświetlanie {{count}} pierwszych zaproszeń.","many":"Wyświetlanie {{count}} pierwszych zaproszeń.","other":"Wyświetlanie {{count}} pierwszych zaproszeń."},"redeemed":"Cofnięte zaproszenia","redeemed_tab":"Przyjęte","redeemed_tab_with_count":"Zrealizowane ({{count}})","redeemed_at":"Przyjęte","pending":"Oczekujące zaproszenia","pending_tab":"Oczekujący","pending_tab_with_count":"Oczekujące ({{count}})","topics_entered":"Obejrzane tematy","posts_read_count":"Przeczytane wpisy","expired":"To zaproszenie wygasło.","rescind":"Usuń","rescinded":"Zaproszenie usunięte","rescind_all":"Usuń wszystkie wygasłe zaproszenia","rescinded_all":"Wszystkie zaproszenia, które wygasły, zostały usunięte!","rescind_all_confirm":"Czy na pewno chcesz usunąć wszystkie wygasłe zaproszenia?","reinvite":"Ponów zaproszenie","reinvite_all":"Wyślij ponownie wszystkie zaproszenia","reinvite_all_confirm":"Jesteś pewny, że chcesz ponownie wysłać wszystkie zaproszenia?","reinvited":"Ponowne wysłanie zaproszenia","reinvited_all":"Wszystkie zaproszenia zostały ponownie wysłane!","time_read":"Czas odczytu","days_visited":"Dni odwiedzin","account_age_days":"Wiek konta w dniach","create":"Wyślij zaproszenie","generate_link":"Skopiuj link z zaproszeniem","link_generated":"Link z zaproszenie został poprawnie wygenerowany!","valid_for":"Link do zaproszenia jest ważny tylko dla tego adresu: %{email}","bulk_invite":{"none":"Jeszcze nikogo nie zaprosiłeś. Możesz wysłać pojedyncze zaproszenia lub zaprosić wiele osób na raz poprzez \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e wysłanie pliku CSV\u003c/a\u003e.","text":"Zaproszenia hurtowe z pliku","success":"Plik został przesłany pomyślnie: otrzymasz prywatną wiadomość, gdy proces zostanie zakończony.","error":"Przykro nam, ale wymagany format pliku to CSV.","confirmation_message":"Za chwilę wyślesz zaproszenia do wszystkich w przesłanym pliku."}},"password":{"title":"Hasło","too_short":"Hasło jest za krótkie.","common":"To hasło jest zbyt popularne.","same_as_username":"Twoje hasło jest takie samo jak nazwa użytkownika.","same_as_email":"Twoje hasło jest takie samo jak twój e-mail.","ok":"Twoje hasło jest poprawne.","instructions":"przynajmniej %{count} znaków"},"summary":{"title":"Podsumowanie","stats":"Statystyki","time_read":"czas odczytu","recent_time_read":"czas ostatniego czytania","topic_count":{"one":"utworzono temat","few":"utworzono tematów","many":"utworzono tematy","other":"utworzono tematy"},"post_count":{"one":"utworzono post","few":"utworzonych postów","many":"utworzono posty","other":"utworzono posty"},"likes_given":{"one":"dano","few":"dano","many":"dano","other":"dano"},"likes_received":{"one":"otrzymano","few":"otrzymano","many":"otrzymano","other":"otrzymano"},"days_visited":{"one":"dzień odwiedzin","few":"dni odwiedzin","many":"dni odwiedzin","other":"dni odwiedzin"},"topics_entered":{"one":"przeczytany temat","few":"przeczytane tematy","many":"przeczytane tematy","other":"przeczytane tematy"},"posts_read":{"one":"przeczytany post","few":"przeczytanych postów","many":"przeczytane posty","other":"przeczytane posty"},"bookmark_count":{"one":"zakładka","few":"zakładki","many":"zakładki","other":"zakładki"},"top_replies":"Najlepsze odpowiedzi","no_replies":"Póki co brak odpowiedzi.","more_replies":"Więcej odpowiedzi","top_topics":"Najlepsze tematy","no_topics":"Póki co brak tematów.","more_topics":"Więcej tematów","top_badges":"Najlepsze odznaki","no_badges":"Póki co brak odznak.","more_badges":"Więcej odznak","top_links":"Najlepsze linki","no_links":"Póki co brak linków.","most_liked_by":"Najbardziej lajkowane przez","most_liked_users":"Najbardziej lajkowane","most_replied_to_users":"Najwięcej odpowiedzi do","no_likes":"Brak lajków.","top_categories":"Popularne kategorie","topics":"Tematy","replies":"Odpowiedzi"},"ip_address":{"title":"Ostatni adres IP"},"registration_ip_address":{"title":"Adres IP rejestracji"},"avatar":{"title":"Awatar","header_title":"profil, wiadomości, zakładki i ustawienia"},"title":{"title":"Tytuł","none":"(brak)"},"primary_group":{"title":"Główna grupa","none":"(brak)"},"filters":{"all":"Wszystkie"},"stream":{"posted_by":"Wysłane przez","sent_by":"Wysłane przez","private_message":"wiadomość","the_topic":"temat"}},"loading":"Wczytuję…","errors":{"prev_page":"podczas próby wczytania","reasons":{"network":"Błąd sieci","server":"błąd serwera","forbidden":"Brak dostępu","unknown":"Błąd","not_found":"Nie znaleziono strony"},"desc":{"network":"Sprawdź swoje połączenie.","network_fixed":"Chyba już w porządku.","server":"Kod błędu: {{status}}","forbidden":"Nie możesz obejrzeć tego zasobu.","not_found":"Ups, aplikacja próbowała otworzyć URL który nie istnieje.","unknown":"Coś poszło nie tak."},"buttons":{"back":"Cofnij","again":"Spróbuj ponownie","fixed":"Załaduj stronę"}},"modal":{"close":"zamknij","dismiss_error":"Odrzuć błąd"},"close":"Zamknij","assets_changed_confirm":"Serwis został zmieniony, czy pozwolisz na przeładowanie strony w celu aktualizacji do najnowszej wersji?","logout":"Nastąpiło wylogowanie.","refresh":"Odśwież","read_only_mode":{"enabled":"Strona jest w trybie tylko-do-odczytu. Możesz nadal przeglądać serwis, ale operacje takie jak postowanie, lajkowanie i inne są wyłączone.","login_disabled":"Logowanie jest zablokowane, gdy strona jest w trybie tylko do odczytu.","logout_disabled":"Wylogowanie jest zablokowane gdy strona jest w trybie tylko do odczytu."},"logs_error_rate_notice":{},"learn_more":"dowiedz się więcej…","all_time":"łącznie","all_time_desc":"łącznie utworzonych tematów","year":"rok","year_desc":"tematy dodane w ciągu ostatnich 365 dni","month":"miesiąc","month_desc":"tematy dodane w ciągu ostatnich 30 dni","week":"tydzień","week_desc":"tematy dodane w ciągu ostatnich 7 dni","day":"dzień","first_post":"Pierwszy wpis","mute":"Wycisz","unmute":"Wyłącz wyciszenie","last_post":"Opublikowano","time_read":"Przeczytane","time_read_recently":"%{time_read} częstości","time_read_tooltip":"%{time_read} całkowity czas czytania","time_read_recently_tooltip":"%{time_read} całkowity czytania (%{recent_time_read} w ciągu ostatnich 60 dni)","last_reply_lowercase":"ostatnia odpowiedź","replies_lowercase":{"one":"odpowiedź","few":"odpowiedzi","many":"odpowiedzi","other":"odpowiedzi"},"signup_cta":{"sign_up":"Rejestracja","hide_session":"Przypomnij mi jutro","hide_forever":"nie, dziękuję","hidden_for_session":"Ok, zapytamy jutro. Pamiętaj, że konto możesz w każdej chwili założyć klikając na 'Logowanie'.","intro":"Hej! Wygląda na to, że zainteresowała Cię ta dyskusja, ale nie posiadasz jeszcze konta.","value_prop":"Jeśli założysz konto, będziemy pamiętać dokładnie to, co przeczytałeś, więc zawsze wrócisz tam, gdzie ostatnio opuściłeś temat. Otrzymasz również powiadomienia, tutaj i za pośrednictwem poczty email, gdy ktoś Ci odpowie. Możesz również polubić posty, aby dzielić się miłością. :heartpulse:"},"summary":{"enabled_description":"Przeglądasz podsumowanie tego tematu: widoczne są jedynie najbardziej wartościowe wpisy zdaniem uczestników. ","description":"Jest \u003cb\u003e{{replyCount}}\u003c/b\u003e odpowiedzi.","description_time":"Istnieją \u003cb\u003e{{replyCount}}\u003c/b\u003e odpowiedzi z czasem czytania oszacowanym na \u003cb\u003e{{readingTime}} minut\u003c/b\u003e.","enable":"Podsumuj ten temat","disable":"Pokaż wszystkie wpisy"},"deleted_filter":{"enabled_description":"Ten temat posiada usunięte wpisy, które zostały ukryte.","disabled_description":"Usunięte wpisy w tym temacie są widoczne.","enable":"Ukryj usunięte wpisy","disable":"Pokaż usunięte wpisy."},"private_message_info":{"title":"Wiadomość","invite":"Zaproś innych","edit":"Dodaj lub usuń","leave_message":"Czy naprawdę chcesz zostawić tę wiadomość?","remove_allowed_user":"Czy naprawdę chcesz usunąć {{name}} z tej dyskusji?","remove_allowed_group":"Czy naprawdę chcesz usunąć {{name}} z tej wiadomości?"},"email":"Email","username":"Nazwa konta","last_seen":"Ostatnio oglądane","created":"Utworzono","created_lowercase":"utworzono","trust_level":"Poziom zaufania","search_hint":"nazwa użytkownika, email lub IP","create_account":{"disclaimer":"Rejestrując się, wyrażasz zgodę na \u003ca href='{{privacy_link}}' target='blank'\u003epolitykę prywatności\u003c/a\u003e i \u003ca href='{{tos_link}}' target='blank'\u003ewarunki świadczenia usług\u003c/a\u003e .","title":"Utwórz konto","failed":"Coś poszło nie tak, możliwe, że wybrany adres email jest już zarejestrowany, spróbuj użyć odnośnika przypomnienia hasła"},"forgot_password":{"title":"Reset hasła","action":"Zapomniałem(-łam) hasła","invite":"Wpisz swoją nazwę użytkownika lub adres email. Wyślemy do ciebie email z linkiem do zresetowania hasła.","reset":"Resetuj hasło","complete_username":"Jeśli jakieś mamy konto o nazwie użytkownika \u003cb\u003e%{username}\u003c/b\u003e, za chwilę zostanie wysłana wiadomość z instrukcją jak ustawić nowe hasło.","complete_email":"Jeśli jakieś konto użytkownika posiada adres \u003cb\u003e%{email}\u003c/b\u003e, za chwilę zostanie wysłana wiadomość z instrukcją jak ustawić nowe hasło.","complete_username_found":"Znaleźliśmy konto pasujące do nazwy użytkownika \u003cb\u003e%{username}\u003c/b\u003e . Powinieneś otrzymać wiadomość e-mail z instrukcjami, jak szybko zresetować hasło.","complete_email_found":"Znaleźliśmy konto pasujące do \u003cb\u003e%{email}\u003c/b\u003e . Powinieneś otrzymać wiadomość e-mail z instrukcjami, jak szybko zresetować hasło.","complete_username_not_found":"Nie znaleziono konta o nazwie \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nie znaleziono konta przypisanego do \u003cb\u003e%{email}\u003c/b\u003e","help":"Email nie dotarł? Upewnij się najpierw czy sprawdziłeś folder spam.\u003cp\u003eNie jesteś pewny jaki email został użyty? Wprowadz adres tutaj, a dowiemy się czy taki istnieje.\u003c/p\u003e\u003cp\u003eJeśli nie masz już dostępu do adresu email zapisanego na twoim koncie, skontaktuj się z \u003ca href='%{basePath}/about'\u003enaszym pomocnym zespołem.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Pomoc"},"email_login":{"link_label":"Wyślij mi link do logowania","button_label":"z e-mailem","complete_username":"Jeśli konto pasuje do nazwy użytkownika \u003cb\u003e%{username}\u003c/b\u003e , \u003cb\u003ewkrótce\u003c/b\u003e otrzymasz wiadomość e-mail z linkiem do logowania.","complete_email":"Jeśli konto pasuje do \u003cb\u003e%{email}\u003c/b\u003e , \u003cb\u003ewkrótce\u003c/b\u003e otrzymasz wiadomość e-mail z linkiem do logowania.","complete_username_found":"Znaleźliśmy konto pasujące do nazwy użytkownika \u003cb\u003e%{username}\u003c/b\u003e , \u003cb\u003ewkrótce\u003c/b\u003e otrzymasz wiadomość e-mail z linkiem do logowania.","complete_email_found":"Znaleźliśmy konto pasujące do \u003cb\u003e%{email}\u003c/b\u003e , \u003cb\u003ewkrótce\u003c/b\u003e otrzymasz wiadomość e-mail z linkiem do logowania.","complete_username_not_found":"Nie znaleziono konta o nazwie \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nie znaleziono konta przypisanego do \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Przejdź do %{site_name}","logging_in_as":"Logowanie jako %{email}","confirm_button":"Dokończ logowanie"},"login":{"title":"Logowanie","username":"Użytkownik","password":"Hasło","second_factor_title":"Dwuskładnikowe uwierzytelnianie","second_factor_description":"Podaj kod uwierzytelniający ze swojej aplikacji:","second_factor_backup":"Zaloguj się, używając kodu zapasowego","second_factor_backup_title":"Kod zapasowy weryfikacji dwuskładnikowej","second_factor_backup_description":"Proszę wprowadź jeden ze swoich zapasowych kodów:","second_factor":"Zaloguj się przy użyciu aplikacji Authenticator","security_key_description":"Po przygotowaniu fizycznego klucza bezpieczeństwa naciśnij przycisk Uwierzytelnij za pomocą klucza bezpieczeństwa poniżej.","security_key_alternative":"Spróbuj w inny sposób","security_key_authenticate":"Uwierzytelnij się za pomocą klucza bezpieczeństwa","security_key_not_allowed_error":"Upłynął limit czasu procesu uwierzytelniania klucza bezpieczeństwa lub został on anulowany.","security_key_no_matching_credential_error":"W podanym kluczu zabezpieczeń nie znaleziono zgodnych poświadczeń.","security_key_support_missing_error":"Twoje obecne urządzenie lub przeglądarka nie obsługuje używania kluczy bezpieczeństwa. Proszę użyć innej metody.","email_placeholder":"adres email lub nazwa użytkownika","caps_lock_warning":"Caps Lock jest włączony","error":"Nieznany błąd","cookies_error":"Wygląda na to, że masz wyłączoną obsługę plików cookie. Możesz nie być w stanie zalogować się bez uprzedniego włączenia ich.","rate_limit":"Poczekaj, zanim ponowisz próbę logowania.","blank_username":"Podaj swój adres e-mail lub nazwę użytkownika.","blank_username_or_password":"Podaj swój email lub nazwę użytkownika i hasło","reset_password":"Resetuj hasło","logging_in":"Uwierzytelnianie…","or":"Lub","authenticating":"Uwierzytelnianie…","awaiting_activation":"Twoje konto czeka na aktywację. Użyj linku przypomnienia hasła, aby otrzymać kolejny email aktywujący.","awaiting_approval":"Twoje konto jeszcze nie zostało zatwierdzone przez osoby z obsługi. Otrzymasz email gdy zostanie zatwierdzone.","requires_invite":"Przepraszamy, dostęp do tego forum jest tylko za zaproszeniem.","not_activated":"Nie możesz się jeszcze zalogować. Wysłaliśmy email aktywujący konto na adres \u003cb\u003e{{sentTo}}\u003c/b\u003e. W celu aktywacji konta postępuj zgodnie z instrukcjami otrzymanymi w emailu.","not_allowed_from_ip_address":"Nie możesz się zalogować z tego adresu IP.","admin_not_allowed_from_ip_address":"Nie możesz się zalogować jako admin z tego adresu IP.","resend_activation_email":"Kliknij tutaj, aby ponownie wysłać email z aktywacją konta.","omniauth_disallow_totp":"Twoje konto ma włączone uwierzytelnianie dwuskładnikowe. Zaloguj się za pomocą swojego hasła.","resend_title":"Wyślij ponownie Email aktywacyjny","change_email":"Zmień Adres Email","provide_new_email":"Wprowadź nowy adres Email. Wyślemy na niego mail potwierdzający.","submit_new_email":"Zaktualizuj adres Email","sent_activation_email_again":"Wysłaliśmy do ciebie kolejny email z aktywacją konta na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Zanim dotrze, może minąć kilka minut; pamiętaj, żeby sprawdzić folder ze spamem.","sent_activation_email_again_generic":"Wysłaliśmy kolejny e-mail aktywacyjny. Przybycie może potrwać kilka minut; koniecznie sprawdź folder ze spamem.","to_continue":"Zaloguj się","preferences":"Musisz się zalogować, aby zmieniać swoje ustawienia.","forgot":"Nie pamiętam konta","not_approved":"Twoje konto nie zostało jeszcze aktywowane. Zostaniesz powiadomiony emailem gdy będziesz mógł się zalogować.","google_oauth2":{"name":"Google","title":"przez Google"},"twitter":{"name":"Twitter","title":"przez Twitter"},"instagram":{"name":"Instagram","title":"z Instagram"},"facebook":{"name":"Facebook","title":"przez Facebook"},"github":{"name":"GitHub","title":"przez GitHub"},"discord":{"name":"Discord","title":"z Discordem"},"second_factor_toggle":{"totp":"Zamiast tego użyj aplikacji uwierzytelniającej","backup_code":"Zamiast tego użyj kodu zapasowego"}},"invites":{"accept_title":"Zaproszenie","welcome_to":"Witaj na %{site_name}!","invited_by":"Zostałeś zaproszony przez:","social_login_available":"Będziesz mógł zalogować się za pomocą dowolnej platformy społecznościowej używając tego adresu e-mail.","your_email":"Adres e-mail przypisany do twojego konta to \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Akceptuj zaproszenie","success":"Twje konto zostało utworzone i zostałeś zalogowany.","name_label":"Nazwa","password_label":"Ustaw hasło","optional_description":"(opcjonalne)"},"password_reset":{"continue":"Przejdź do %{site_name}"},"emoji_set":{"apple_international":"Apple/Międzynarodowy","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (wcześniej EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Tylko kategorie","categories_with_featured_topics":"Kategorie z wybranymi tematami","categories_and_latest_topics":"Kategorie i ostatnie tematy","categories_and_top_topics":"Kategorie i najlepsze tematy","categories_boxes":"Pudełka z podkategoriami","categories_boxes_with_topics":"Pudełka z polecanymi tematami"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Wejść"},"conditional_loading_section":{"loading":"Ładowanie..."},"category_row":{"topic_count":"{{count}} tematów w tej kategorii"},"select_kit":{"default_header_text":"Wybierz...","no_content":"Nie znaleziono dopasowań","filter_placeholder":"Wyszukiwanie...","filter_placeholder_with_any":"Wyszukaj lub utwórz ...","create":"Stwórz: '{{content}}'","max_content_reached":{"one":"Możesz wybrać tylko jeden element.","few":"Może wybrać tylko {{count}} elementy.","many":"Możesz wybrać tylko {{count}} elementów.","other":"Możesz wybrać tylko {{count}} elementów."},"min_content_not_reached":{"one":"Wybierz co najmniej jeden element.","few":"Wybierz co najmniej {{count}} elementy.","many":"Wybierz co najmniej {{count}} elementów.","other":"Wybierz co najmniej {{count}} elementów."},"invalid_selection_length":"Zaznaczenie musi zawierać co najmniej {{count}} znaków."},"date_time_picker":{"from":"Od","to":"Do","errors":{"to_before_from":"Do daty musi być późniejsza niż data."}},"emoji_picker":{"filter_placeholder":"Szukaj emoji","smileys_\u0026_emotion":"Emotikony i emocje","people_\u0026_body":"Ludzie i ciało","animals_\u0026_nature":"Zwierzęta i przyroda","food_\u0026_drink":"Jedzenie i picie","travel_\u0026_places":"Podróże i miejsca","activities":"Zajęcia","objects":"Obiekty","symbols":"Symbolika","flags":"Flagi","recent":"Ostatnio używane","default_tone":"Brak koloru skóry","light_tone":"Jasny kolor skóry","medium_light_tone":"Średnio jasny kolor skóry","medium_tone":"Średni kolor skóry","medium_dark_tone":"Średnio ciemny kolor skóry","dark_tone":"Ciemny kolor skóry","default":"Spersonalizowane emoji"},"shared_drafts":{"title":"Udostępnione projekty","notice":"Ten temat jest widoczny tylko użytkowników mających dostęp do kategorii \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"Kategoria docelowa","publish":"Opublikuj udostępniony projekt","confirm_publish":"Czy na pewno chcesz opublikować ten projekt?","publishing":"Publikowanie tematu..."},"composer":{"emoji":"Emoji :)","more_emoji":"więcej…","options":"Opcje","whisper":"szept","unlist":"nie widoczny","blockquote_text":"Cytat","add_warning":"To jest oficjalne ostrzeżenie.","toggle_whisper":"Przełącz szept","toggle_unlisted":"Przycisk ukrywania","posting_not_on_topic":"W którym temacie chcesz odpowiedzieć?","saved_local_draft_tip":"zapisano lokalnie","similar_topics":"Twój temat jest podobny do…","drafts_offline":"szkice offline","edit_conflict":"edytuj konflikt","group_mentioned_limit":"\u003cb\u003eOstrzeżenie!\u003c/b\u003e Wspomniałeś o \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e , jednak ta grupa ma więcej członków niż skonfigurowany przez administratora limit wzmianek dla użytkowników {{max}}. Nikt nie zostanie powiadomiony.","group_mentioned":{"one":"Wspominając {{group}}, powiadomisz \u003ca href='{{group_link}}'\u003e%{count} osobę\u003c/a\u003e – czy jesteś pewien?","few":"Wspominając {{group}}, powiadomisz \u003ca href='{{group_link}}'\u003e{{count}} osoby\u003c/a\u003e – czy jesteś pewien?","many":"Wspominając {{group}}, powiadomisz \u003ca href='{{group_link}}'\u003e{{count}} osób\u003c/a\u003e – czy jesteś pewien?","other":"Wspominając {{group}}, powiadomisz \u003ca href='{{group_link}}'\u003e{{count}} osób\u003c/a\u003e –czy jesteś pewien?"},"cannot_see_mention":{"category":"Wspomniałeś o {{username}} lecz nie zostaną oni powiadomieni ponieważ nie mają dostępu do tej kategorii. Dodaj ich do grupy która ma dostęp do tej kategorii.","private":"Wspomniałeś o {{username}} lecz nie zostaną powiadomieni ponieważ nie mogą odczytać tej wiadomości . Będziesz musiał ich zaprosić do odczytania tej wiadomości "},"duplicate_link":"Wygląda na to, że Twój link do \u003cb\u003e{{domain}}\u003c/b\u003e został już wcześniej przesłany w tym wątku przez \u003cb\u003e@{{username}}\u003c/b\u003e w \u003ca href='{{post_url}}'\u003eodpowiedzi przesłanej {{ago}}\u003c/a\u003e - jesteś pewien, że chcesz go wysłać ponownie?","reference_topic_title":"Odpowiedz: {{title}}","error":{"title_missing":"tytuł jest wymagany","title_too_short":"tytuł musi zawierać co najmniej {{min}} znaków","title_too_long":"Tytuł nie może zawierać więcej niż {{max}} znaków","post_missing":"Post nie może być pusty","post_length":"Wpis musi zawierać przynajmniej {{min}} znaków","try_like":"Czy wypróbowałeś przycisk {{heart}}?","category_missing":"Musisz wybrać kategorię","tags_missing":"Musisz wybrać co najmniej {{count}} tagów","topic_template_not_modified":"Dodaj szczegóły i szczegóły do swojego tematu, edytując szablon tematu."},"save_edit":"Zapisz zmiany","overwrite_edit":"Zastąp edycję","reply_original":"Odpowiedz na Oryginalny Temat","reply_here":"Odpowiedz tutaj","reply":"Odpowiedz","cancel":"Anuluj","create_topic":"Utwórz temat","create_pm":"Wiadomość","create_whisper":"Szept","create_shared_draft":"Utwórz udostępniony projekt","edit_shared_draft":"Edytuj udostępniony projekt","title":"Lub naciśnij Ctrl+Enter","users_placeholder":"Dodaj osobę","title_placeholder":"O czym jest ta dyskusja w jednym zwartym zdaniu. ","title_or_link_placeholder":"Wprowadź tytuł, lub wklej tutaj link","edit_reason_placeholder":"powód edycji?","topic_featured_link_placeholder":"Wstaw link pod nazwą ","remove_featured_link":"Usuń link z tematu.","reply_placeholder":"Pisz w tym miejscu. Wspierane formatowanie to Markdown, BBCode lub HTML. Możesz też przeciągnąć tu obrazek.","reply_placeholder_no_images":"Pisz w tym miejscu. Wspierane formatowanie to Markdown, BBCode lub HTML.","reply_placeholder_choose_category":"Wybierz kategorię przed pisaniem tutaj.","view_new_post":"Zobacz Twój nowy wpis.","saving":"Zapisywanie","saved":"Zapisano!","saved_draft":"Publikowanie wersji roboczej w toku. Stuknij, aby wznowić.","uploading":"Wczytuję…","show_preview":"pokaż podgląd \u0026raquo;","hide_preview":"\u0026laquo; schowaj podgląd","quote_post_title":"Cytuj cały wpis","bold_label":"Pogrubienie","bold_title":"Pogrubienie","bold_text":"pogrubiony tekst","italic_label":"Kursywa","italic_title":"Wyróżnienie","italic_text":"wyróżniony tekst","link_title":"Odnośnik","link_description":"wprowadź tutaj opis odnośnika","link_dialog_title":"Wstaw odnośnik","link_optional_text":"opcjonalny tytuł","link_url_placeholder":"Wklej adres URL lub wpisz, aby wyszukać tematy","quote_title":"Cytat","quote_text":"Cytat","code_title":"Tekst sformatowany","code_text":"Sformatowany blok tekstu poprzedź 4 spacjami","paste_code_text":"wpisz lub wklej tutaj kod","upload_title":"Dodaj","upload_description":"wprowadź opis tutaj","olist_title":"Lista numerowana","ulist_title":"Lista wypunktowana","list_item":"Element listy","toggle_direction":"Zmień kierunek","help":"Pomoc formatowania Markdown","collapse":"zminimalizuj panel kompozytora","open":"otwórz panel kompozytora","abandon":"zamknij kompozytora i odrzuć wersję roboczą","enter_fullscreen":"wprowadź kompozytora na pełnym ekranie","exit_fullscreen":"zamknij kompozytora na pełnym ekranie","modal_ok":"OK","modal_cancel":"Anuluj","cant_send_pm":"Przepraszamy, niestety nie możesz wysłać prywatnej wiadomości do %{username}.","yourself_confirm":{"title":"Nie zapomniałeś dodać odbiorców?","body":"Aktualnie ta wiadomość będzie wysłana tylko do ciebie!"},"admin_options_title":"Opcjonalne ustawienia zespołu dla tego tematu","composer_actions":{"reply":"Odpowiedź","draft":"Wersja robocza","edit":"Edycja","reply_to_post":{"label":"Odpowiedz na post %{postNumber} przez %{postUsername}","desc":"Odpowiedz na określony post"},"reply_as_new_topic":{"label":"Odpowiedz jako powiązany temat","desc":"Utwórz nowy temat powiązany z tym tematem","confirm":"Zapisano nową wersję roboczą tematu, która zostanie zastąpiona, jeśli utworzysz połączony temat."},"reply_as_private_message":{"label":"Nowa wiadomość","desc":"Utwórz nową osobistą wiadomość"},"reply_to_topic":{"label":"Odpowiedz na temat","desc":"Odpowiedz na temat, a nie żaden konkretny post"},"toggle_whisper":{"label":"Przełącz szept","desc":"Szepty są widoczne tylko dla pracowników"},"create_topic":{"label":"Nowy temat"},"shared_draft":{"label":"Udostępniony projekt","desc":"Opracuj temat, który będzie widoczny tylko dla personelu"},"toggle_topic_bump":{"label":"Przełącz wypukłość tematu","desc":"Odpowiedz bez zmiany ostatniej daty odpowiedzi"}},"details_title":"Podsumowanie","details_text":"Ten tekst zostanie ukryty"},"notifications":{"tooltip":{"regular":{"one":"%{count} nieprzeczytane powiadomienie","few":"Nieprzeczytanych powiadomień: {{count}}","many":"Nieprzeczytanych powiadomień: {{count}}","other":"Nieprzeczytanych powiadomień: {{count}}"},"message":{"one":"Nieodczytane wiadomości: {{count}}","few":"Nieodczytane wiadomości: {{count}}","many":"Nieodczytane wiadomości: {{count}}","other":"Nieodczytane wiadomości: 1"},"high_priority":{"one":"%{count} nieprzeczytane powiadomienie o wysokim priorytecie","few":"%{count} nieprzeczytane powiadomienie o wysokim priorytecieis","many":"%{count} nieprzeczytane powiadomienie o wysokim priorytecieis","other":"%{count} nieprzeczytane powiadomienie o wysokim priorytecieis"}},"title":"powiadomienia o wywołanej @nazwie, odpowiedzi do twoich wpisów i tematów, prywatne wiadomości, itp","none":"Nie udało się załadować listy powiadomień.","empty":"Nie znaleziono powiadomień.","post_approved":"Twój post został zatwierdzony","reviewable_items":"przedmioty wymagające przeglądu","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} i %{count} inna osoba\u003c/span\u003e {{description}}","few":"\u003cspan\u003e{{username}}, {{username2}} i {{count}} inne osoby\u003c/span\u003e {{description}}","many":"\u003cspan\u003e{{username}}, {{username2}} i {{count}} innych osób\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} i {{count}} innych osób\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"polubiłem {{count}} twoich postów","few":"polubiłem {{count}} twoich postów","many":"polubiłem {{count}} twoich postów","other":"polubiono {{count}} twoich postów"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e przyjmuje twoje zaproszenie","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e przenosi {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Otrzymujesz '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNowy temat\u003c/span\u003e {{description}}","membership_request_accepted":"Członkostwo zaakceptowane w „{{group_name}}”","membership_request_consolidated":"{{count}} otwarte wnioski o członkostwo dla „{{group_name}}”","group_message_summary":{"one":"masz {{count}} wiadomość w skrzynce odbiorczej {{group_name}}","few":"masz {{count}} wiadomości w skrzynce odbiorczej {{group_name}}","many":"masz {{count}} wiadomości w skrzynce odbiorczej {{group_name}}","other":"masz {{count}} wiadomości w skrzynce odbiorczej {{group_name}}"},"popup":{"mentioned":"{{username}} wspomina o tobie w \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} wspomniał o Tobie w \"{{topic}}\" - {{site_title}}","quoted":"{{username}} cytuje cie w \"{{topic}}\" - {{site_title}}","replied":"{{username}} odpowiada na twój wpis w \"{{topic}}\" - {{site_title}}","posted":"{{username}} pisze w \"{{topic}}\" - {{site_title}}","private_message":"{{username}} wysłał Ci osobistą wiadomość w „{{topic}}” - {{site_title}}","linked":"{{username}} linkuje do twojego wpisu z \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} utworzył nowy temat „{{topic}}” - {{site_title}}","confirm_title":"Powiadomienia włączone - %{site_title}","confirm_body":"Powodzenie! Powiadomienia zostały włączone.","custom":"Powiadomienie od {{username}} na %{site_title}"},"titles":{"mentioned":"wzmiankowany","replied":"nowa odpowiedź","quoted":"zacytowany","edited":"edytowane","liked":"nowe polubienie","private_message":"nowa prywatna wiadomość","invited_to_private_message":"zaproszony na prywatną wiadomość","invitee_accepted":"zaproszenie przyjęte","posted":"nowy post","moved_post":"post został przeniesiony","linked":"połączony","bookmark_reminder":"przypomnienie o zakładce","bookmark_reminder_with_name":"przypomnienie o zakładce - %{name}","granted_badge":"przyznana odznaka","invited_to_topic":"zaproszony do tematu","group_mentioned":"wspomniana grupa","group_message_summary":"nowe wiadomości grupowe","watching_first_post":"nowy temat","topic_reminder":"przypomnienie tematu","liked_consolidated":"nowe polubienia","post_approved":"post zatwierdzony","membership_request_consolidated":"nowe wnioski o członkostwo"}},"upload_selector":{"title":"Dodaj obraz","title_with_attachments":"Dodaj obraz lub plik","from_my_computer":"Z mojego urządzenia","from_the_web":"Z Internetu","remote_tip":"link do obrazu","remote_tip_with_attachments":"link do obrazu lub pliku {{authorized_extensions}}","local_tip":"wybierz obrazy ze swojego urządzenia","local_tip_with_attachments":"wybierz obrazy lub pliki ze swojego urządzenia {{authorized_extensions}}","hint":"(możesz także upuścić plik z katalogu komputera w okno edytora)","hint_for_supported_browsers":"możesz też przeciągać lub wklejać grafiki do edytora","uploading":"Wgrywanie","select_file":"Wybierz plik","default_image_alt_text":"Obraz"},"search":{"sort_by":"Sortuj po","relevance":"Trafność","latest_post":"Aktualne wpisy","latest_topic":"Najnowszy wątek","most_viewed":"Popularne","most_liked":"Najbardziej lajkowane","select_all":"Zaznacz wszystkie","clear_all":"Wyczyść wszystkie","too_short":"Wyszukiwana fraza jest zbyt krótka.","result_count":{"one":"\u003cspan\u003eWynik\u003c/span\u003e \u003cspan class='term'\u003e%{count}\u003c/span\u003e \u003cspan\u003edla\u003c/span\u003e \u003cspan class='term'\u003e{{term}}\u003c/span\u003e","few":"\u003cspan\u003e{{count}}{{plus}} wyniki dla\u003c/span\u003e \u003cspan class='term'\u003e{{term}}\u003c/span\u003e","many":"\u003cspan\u003e{{count}}{{plus}} wyniki dla\u003c/span\u003e \u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} wyniki dla\u003c/span\u003e \u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"szukaj tematów, wpisów, użytkowników lub kategorii","full_page_title":"szukaj tematów lub postów","no_results":"Brak wyników wyszukiwania","no_more_results":"Nie znaleziono więcej wyników.","searching":"Szukam…","post_format":"#{{post_number}} za {{username}}","results_page":"Wyniki wyszukiwania dla '{{term}}'","more_results":"Istnieje więcej wyników wyszukiwania. Doprecyzuj kryteria wyszukiwania.","cant_find":"Nie możesz znaleźć tego, czego szukasz?","start_new_topic":"Może utwórz nowy temat?","or_search_google":"Albo spróbuj wyszukać w Google:","search_google":"Spróbuj wyszukać w Google:","search_google_button":"Google","search_google_title":"Przeszukaj tę stronę","context":{"user":"Szukaj wpisów @{{username}}","category":"Szukaj w kategorii #{{category}}","tag":"Wyszukaj znacznik # {{tag}}","topic":"Szukaj w tym temacie","private_messages":"Wyszukiwanie wiadomości"},"advanced":{"title":"Zaawansowane wyszukiwanie","posted_by":{"label":"Wysłane przez"},"in_category":{"label":"Skategoryzowane"},"in_group":{"label":"W grupie"},"with_badge":{"label":"Z odnaką"},"with_tags":{"label":"Otagowane"},"filters":{"label":"Zwracaj tylko tematy / posty ...","title":"Dopasowanie tylko w tytule","likes":"Lubię","posted":"Opublikowałem w","created":"ja stworzyłem","watching":"Obserwuję","tracking":"Śledzę","private":"W moich wiadomościach","bookmarks":"Dodałeś do zakładek","first":"tylko najnowsze posty ","pinned":"są przypięte","unpinned":"są nie przypięte","seen":"Przeczytałem","unseen":"Nie przeczytałem","wiki":"są postami wiki","images":"Zawiera obrazki","all_tags":"Zawiera wszystkie tagi"},"statuses":{"label":"Tematy gdzie","open":"są otwarte","closed":"są zamknięte","public":"są publiczne","archived":"są archiwizowane","noreplies":"ma zero odpowiedzi","single_user":"zawierają użytkownika"},"post":{"count":{"label":"Minimalna liczba postów"},"time":{"label":"Opublikowano","before":"przed","after":"po"}}}},"hamburger_menu":"przejdź do innej listy lub kategorii","new_item":"nowy","go_back":"wróć","not_logged_in_user":"strona użytkownika z podsumowaniem bieżących działań i ustawień","current_user":"idź do swojej strony użytkowanika","view_all":"Pokaż wszystkie","topics":{"new_messages_marker":"ostatnia wizyta","bulk":{"select_all":"Zaznacz wszystkie","clear_all":"Wyczyść wszystko","unlist_topics":"Ukryj tematy","relist_topics":"Odśwież listę tematów","reset_read":"Wyzeruj przeczytane","delete":"Usuń tematy","dismiss":"Wyczyść","dismiss_read":"Wyczyść nieprzeczytane","dismiss_button":"Wyczyść…","dismiss_tooltip":"Wyczyść nowe wpisy lub przestań śledzić tematy","also_dismiss_topics":"Przestać śledzić wskazane tematy. Nie chcę, aby pojawiały się w zakładce nieprzeczytane.","dismiss_new":"Wyczyść nowe","toggle":"włącz grupowe zaznaczanie tematów","actions":"Operacje grupowe","change_category":"Ustaw kategorię","close_topics":"Zamknij wpisy","archive_topics":"Zarchiwizuj tematy","notification_level":"Powiadomienia","choose_new_category":"Wybierz nową kategorię dla tematów:","selected":{"one":"Zaznaczono \u003cb\u003e%{count}\u003c/b\u003e temat.","few":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematy.","many":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematów.","other":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematów."},"change_tags":"Zmień tagi","append_tags":"Dodaj tagi","choose_new_tags":"Wybierz nowe tagi dla tych tematów:","choose_append_tags":"Wybierz nowe tagi dla tych tematów:","changed_tags":"Tagi tych tematów były zmieniane."},"none":{"unread":"Nie masz nieprzeczytanych tematów.","new":"Nie masz nowych tematów.","read":"You haven't read any topics yet.","posted":"Jeszcze nie zamieściłeś wpisu w żadnym z tematów.","latest":"Nie ma najnowszych tematów. Smutne.","bookmarks":"Nie posiadasz tematów dodanych do zakładek.","category":"Nie ma tematów w kategorii {{category}}.","top":"Brak najlepszych tematów.","educate":{"new":"\u003cp\u003eNowe tematy będą pojawiać się tutaj.\u003c/p\u003e\u003cp\u003eDomyślnie tematy są określane jako nowe i będą oznaczone jako\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enowe\u003c/span\u003e jeśli były stworzone w ciągu ostatnich 2 dni.\u003c/p\u003e\u003cp\u003eOdwiedź swoje \u003ca href=\"%{userPrefsUrl}\"\u003eustawienia\u003c/a\u003e by to zmienić.\u003c/p\u003e","unread":"\u003cp\u003eTwoje nie przeczytane tematy będą pojawiać się tutaj.\u003c/p\u003e\u003cp\u003eDomyślnie tematy są określane jako nieprzeczytane a ich liczba zostanie wyświetlona\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e Jeśli:\u003c/p\u003e\u003cul\u003e\u003cli\u003eUtworzyłeś temat\u003c/li\u003e\u003cli\u003eOdpowiedziałeś w temacie\u003c/li\u003e\u003cli\u003eCzytałeś temat dłużej niż 4 minuty\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eAlbo ustawiłeś śledzenie lub obserwowanie tematu przez kontrolę powiadomień na dole każdego tematu .\u003c/p\u003e\u003cp\u003eOdwiedź swoje \u003ca href=\"%{userPrefsUrl}\"\u003eustawienia\u003c/a\u003e by to zmienić.\u003c/p\u003e"}},"bottom":{"latest":"Nie ma więcej najnowszych tematów.","posted":"Nie ma więcej tematów w których pisałeś.","read":"Nie ma więcej przeczytanych tematów.","new":"Nie ma więcej nowych tematów.","unread":"Nie ma więcej nieprzeczytanych tematów.","category":"Nie ma więcej tematów w kategorii {{category}}.","top":"Nie ma już więcej najlepszych tematów.","bookmarks":"Nie ma więcej zakładek."}},"topic":{"filter_to":{"one":"%{count} post w temacie","few":"{{count}} posty w temacie","many":"{{count}} postów w temacie","other":"{{count}} postów w temacie"},"create":"Nowy temat","create_long":"Utwórz nowy temat","open_draft":"Otwórz szkic","private_message":"Napisz wiadomość","archive_message":{"help":"Przenieś wiadomość do archiwum","title":"Archiwum"},"move_to_inbox":{"title":"Przenieś do skrzynki odbiorczej","help":"Przenieś wiadomość z powrotem do skrzynki odbiorczej"},"edit_message":{"help":"Edytuj pierwszy post wiadomości","title":"Edytuj wiadomość"},"defer":{"help":"Oznacz jako nieprzeczytane","title":"Zignoruj"},"feature_on_profile":{"help":"Dodaj link do tego tematu na karcie użytkownika i profilu","title":"Funkcja na profilu"},"remove_from_profile":{"warning":"Twój profil ma już polecany temat. Jeśli będziesz kontynuować, ten temat zastąpi istniejący.","help":"Usuń link do tego tematu w swoim profilu użytkownika","title":"Usuń z profilu"},"list":"Tematy","new":"nowy temat","unread":"nieprzeczytane","new_topics":{"one":"%{count} nowy temat","few":"{{count}} nowe tematy","many":"{{count}} nowych tematów","other":"{{count}} nowych tematów"},"unread_topics":{"one":"%{count} nieprzeczytany temat","few":"{{count}} nieprzeczytane tematy","many":"{{count}} nieprzeczytanych tematów","other":"{{count}} nieprzeczytanych tematów"},"title":"Temat","invalid_access":{"title":"Temat jest prywatny","description":"Przepraszamy, nie masz dostępu do tego tematu!","login_required":"Musisz się zalogować, aby zobaczyć ten temat."},"server_error":{"title":"Wystąpił błąd przy wczytywaniu Tematu","description":"Przepraszamy, nie możliwe było wczytanie tematu, możliwe że wystąpił problem z połączeniem. Prosimy, spróbuj ponownie. Jeżeli problem wystąpi ponownie, powiadom administrację."},"not_found":{"title":"Temat nie został znaleziony","description":"Przepraszamy, ale temat nie został znaleziony. Możliwe, że został usunięty przez moderatora?"},"total_unread_posts":{"one":"masz %{count} nieprzeczytany wpis w tym temacie","few":"masz {{count}} nieprzeczytane wpisy w tym temacie","many":"masz {{count}} nieprzeczytanych wpisów w tym temacie","other":"masz {{count}} nieprzeczytanych wpisów w tym temacie"},"unread_posts":{"one":"masz %{count} nieprzeczytany wpis w tym temacie","few":"masz {{count}} nieprzeczytane wpisy w tym temacie","many":"masz {{count}} nieprzeczytanych wpisów w tym temacie","other":"masz {{count}} nieprzeczytanych wpisów w tym temacie"},"new_posts":{"one":"od Twoich ostatnich odwiedzin pojawił się %{count} nowy wpis","few":"od Twoich ostatnich odwiedzin pojawiły się {{count}} nowe wpisy","many":"od Twoich ostatnich odwiedzin pojawiło się {{count}} nowych wpisów","other":"od Twoich ostatnich odwiedzin pojawiło się {{count}} nowych wpisów"},"likes":{"one":"temat zawiera %{count} lajk","few":"temat zawiera {{count}} lajki","many":"temat zawiera {{count}} lajków","other":"temat zawiera {{count}} lajków"},"back_to_list":"Wróć do Listy Tematów","options":"Opcje tematu","show_links":"pokaż odnośniki z tego tematu","toggle_information":"przełącz szczegóły tematu","read_more_in_category":"Chcesz przeczytać więcej? Przeglądaj inne tematy w {{catLink}} lub {{latestLink}}.","read_more":"Chcesz przeczytać więcej? {{catLink}} lub {{latestLink}}.","group_request":"Aby zobaczyć ten temat, musisz poprosić o członkostwo w grupie `{{name}}`","group_join":"Musisz dołączyć do grupy `{{name}}`, aby zobaczyć ten temat","group_request_sent":"Twoja prośba o członkostwo w grupie została wysłana. Zostaniesz poinformowany, kiedy zostanie zaakceptowane.","unread_indicator":"Nikt jeszcze nie czytał ostatniego postu w tym temacie.","browse_all_categories":"Przeglądaj wszystkie kategorie","view_latest_topics":"pokaż aktualne tematy","suggest_create_topic":"Może rozpoczniesz temat?","jump_reply_up":"przeskocz do wcześniejszej odpowiedzi","jump_reply_down":"przeskocz do późniejszej odpowiedzi","deleted":"Temat został usunięty","topic_status_update":{"title":"Timer tematów","save":"Ustaw czas","num_of_hours":"Liczba godzin:","num_of_days":"Liczba dni:","remove":"Usuń czas","publish_to":"Opublikuj do:","when":"Kiedy:","public_timer_types":"Timery tematów","time_frame_required":"Wybierz przedział czasowy"},"auto_update_input":{"none":"Wybierz przedział czasowy","later_today":"Później dzisiaj","tomorrow":"Jutro","later_this_week":"Później w tym tygodniu","this_weekend":"W ten weekend","next_week":"Następny tydzień","two_weeks":"Dwa tygodnie","next_month":"Następny miesiąc","two_months":"Dwa miesiące","three_months":"Trzy miesiące","four_months":"Cztery miesiące","six_months":"Sześć miesięcy","one_year":"Jeden rok","forever":"Zawsze","pick_date_and_time":"Wybierz datę i czas","set_based_on_last_post":"Zamknij na podstawie ostatniego postu"},"publish_to_category":{"title":"Zaplanuj publikację"},"temp_open":{"title":"Otwórz tymczasowo"},"auto_reopen":{"title":"Automatycznie otwórz wątek"},"temp_close":{"title":"Zamknij tymczasowo"},"auto_close":{"title":"Automatycznie zamknij wątek","label":"Godziny automatycznego zamknięcia:","error":"Wprowadź poprawną wartość.","based_on_last_post":"Nie zamykaj tematu dopóki od ostatniego wpisu nie upłynie przynajmniej tyle czasu."},"auto_delete":{"title":"Automatycznie usuń wątek"},"reminder":{"title":"Przypomnij mi"},"status_update_notice":{"auto_open":"Ten wątek zostanie automatycznie otwarty po %{timeLeft}.","auto_close":"Ten wątek zostanie automatycznie zamknięty po %{timeLeft}.","auto_publish_to_category":"Wątek zostanie opublikowany w \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Ten watek zostanie automatycznie zamknięty po %{count} minutach od ostatniego wpisu.","auto_delete":"Ten wątek zostanie automatycznie zamknięty po %{timeLeft}.","auto_bump":"Ten temat zostanie automatycznie podbity %{timeLeft}.","auto_reminder":"Otrzymasz przypomnienie o tym temacie %{timeLeft}."},"auto_close_title":"Ustawienia automatycznego zamykania","auto_close_immediate":{"one":"Ostatni wpis w tym temacie został zamieszczony %{count} godzinę temu, więc zostanie on natychmiastowo zamknięty.","few":"Ostatni wpis w tym temacie został zamieszczony %{hours} godziny temu, więc zostanie on natychmiastowo zamknięty.","many":"Ostatni wpis w tym temacie został zamieszczony %{count} godzin temu, więc zostanie on natychmiastowo zamknięty.","other":"Ostatni wpis w tym temacie został zamieszczony %{hours} godzin temu, więc zostanie on natychmiastowo zamknięty."},"timeline":{"back":"Wstecz","back_description":"Wróć do ostatniego nieprzeczytanego postu","replies_short":"%{current} / %{total}"},"progress":{"title":"postęp tematu","go_top":"początek","go_bottom":"koniec","go":"idź","jump_bottom":"Przejdź na koniec","jump_prompt":"skocz do...","jump_prompt_of":"%{count} postów","jump_prompt_long":"Skocz do...","jump_bottom_with_number":"przeskocz do wpisu %{post_number}","jump_prompt_to_date":"do daty","jump_prompt_or":"lub","total":"w sumie wpisów","current":"obecny wpis"},"notifications":{"title":"Ustaw jak często chcesz być powiadamiany o tym temacie","reasons":{"mailing_list_mode":"Masz włączony tryb powiadomień mailowych, więc będziesz otrzymywał powiadomienia o nowych odpowiedziach w tym temacie za pośrednictwem poczty e-mail","3_10":"Będziesz otrzymywał powiadomienia, ponieważ temat zawiera obserwowany przez Ciebie tag","3_6":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie i temacie, ponieważ obserwujesz tę kategorię.","3_5":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ włączono automatyczne obserwowanie tego tematu.","3_2":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ obserwujesz ten temat.","3_1":"Będziesz otrzymywać powiadomienia, ponieważ jesteś autorem tego tematu.","3":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ obserwujesz ten temat.","2_8":"Widzisz ilość nowych odpowiedzi, ponieważ śledzisz kategorię wątku.","2_4":"Widzisz ilość nowych odpowiedzi, ponieważ wypowiedziałeś się w tym wątku.","2_2":"Widzisz ilość nowych odpowiedzi, ponieważ śledzisz ten wątek.","2":"Widzisz ilość nowych odpowiedzi, ponieważ przeczytałeś \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eten wątek\u003c/a\u003e.","1_2":"Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis.","1":"Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis.","0_7":"Ignorujesz wszystkie powiadomienia z tej kategorii.","0_2":"Ignorujesz wszystkie powiadomienia w tym temacie.","0":"Ignorujesz wszystkie powiadomienia w tym temacie."},"watching_pm":{"title":"Obserwuj wszystko","description":"Dostaniesz powiadomienie o każdym nowym wpisie w tej dyskusji. Liczba nowych wpisów pojawi się obok jej tytułu na liście wiadomości."},"watching":{"title":"Obserwuj wszystko","description":"Dostaniesz powiadomienie o każdym nowym wpisie w tym temacie. Liczba nowych wpisów pojawi się obok jego tytułu na liście wiadomości."},"tracking_pm":{"title":"Śledzenie","description":"Licznik nowych odpowiedzi zostanie pokazany dla tej wiadomości. Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"tracking":{"title":"Śledzenie","description":"Licznik nowych odpowiedzi zostanie pokazany dla tego tematu. Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"regular":{"title":"Normalny","description":"Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"regular_pm":{"title":"Normalny","description":"Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"muted_pm":{"title":"Wyciszono","description":"Nie będziesz otrzymywać powiadomień dotyczących tej dyskusji."},"muted":{"title":"Wyciszenie","description":"Nie otrzymasz powiadomień o nowych wpisach w tym temacie. Nie pojawią się na liście nieprzeczytanych"}},"actions":{"title":"Akcje","recover":"Przywróć temat","delete":"Usuń temat","open":"Otwórz temat","close":"Zamknij temat","multi_select":"Wybierz wpisy…","timed_update":"Ustaw ważność wątku...","pin":"Przypnij temat…","unpin":"Odepnij temat…","unarchive":"Przywróć z archiwum","archive":"Archiwizuj temat","invisible":"Ustaw jako niewidoczny","visible":"Ustaw jako widoczny","reset_read":"Zresetuj przeczytane dane","make_public":"Upublicznij temat","make_private":"Utwórz osobistą wiadomość","reset_bump_date":"Zresetuj datę podbicia"},"feature":{"pin":"Przypnij temat","unpin":"Odepnij temat","pin_globally":"Przypnij temat globalnie","make_banner":"Ustaw jako baner","remove_banner":"Wyłącz baner"},"reply":{"title":"Odpowiedz","help":"zacznij tworzyć odpowiedź do tego tematu"},"clear_pin":{"title":"Odepnij","help":"Odepnij ten temat. Przestanie wyświetlać się na początku listy tematów."},"share":{"title":"Udostępnij","extended_title":"Udostępnij link","help":"udostępnij odnośnik do tego tematu"},"print":{"title":"Drukuj","help":"Otwórz widok wydruku dla tego tematu"},"flag_topic":{"title":"Zgłoś","help":"zgłoś ten temat, aby zwrócić uwagę moderacji lub wyślij powiadomienie o nim","success_message":"Ten temat został pomyślnie zgłoszony."},"make_public":{"title":"Konwertuj na temat publiczny","choose_category":"Wybierz kategorię dla tematu publicznego:"},"feature_topic":{"title":"Wyróżnij ten temat","pin":"Wyróżnij ten temat przypinając go na górze w kategorii {{categoryLink}} do","confirm_pin":"Czy na pewno przypiąć ten temat w tej kategorii? Masz już {{count}} przypiętych tematów -- zbyt wiele może obniżyć czytelność innych aktywnych tematów.","unpin":"Odepnij ten temat z początku kategorii {{categoryLink}}.","unpin_until":"Odepnij ten temat z początku kategorii {{categoryLink}} lub poczekaj do \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Każdy użytkownik może samodzielnie usunąć przypięcie dla samego siebie.","pin_validation":"Przypięcie tego tematu wymaga podania daty.","not_pinned":"Brak przypiętych tematów w {{categoryLink}}.","already_pinned":{"one":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","few":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Wyróżnij ten temat przypinając go na górze wszystkich list do","confirm_pin_globally":"Czy na pewno chcesz globalnie przypiąć kolejny temat? Masz już {{count}} przypiętych tematów -- zbyt wiele może obniżyć czytelność innych aktywnych tematów.","unpin_globally":"Usuń wyróżnienie dla tego tematu odpinając go z początku wszystkich list.","unpin_globally_until":"Usuń wyróżnienie dla tego tematu odpinając go z początku wszystkich list lub poczekaj do \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Każdy użytkownik może samodzielnie usunąć przypięcie dla samego siebie.","not_pinned_globally":"Brak przypiętych globalnie tematów.","already_pinned_globally":{"one":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e.","few":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","many":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","other":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"make_banner":"Ustaw ten temat jako baner wyświetlany na górze każdej strony.","remove_banner":"Usuń ten temat jako baner wyświetlany na górze każdej strony.","banner_note":"Użytkownicy mogą usunąć baner zamykając go przyciskiem. Tylko jeden temat może być banerem w danej chwili.","no_banner_exists":"Baner nie jest obecnie ustawiony.","banner_exists":"Baner \u003cstrong class='badge badge-notification unread'\u003ejest\u003c/strong\u003e obecnie ustawiony."},"inviting":"Zapraszam…","automatically_add_to_groups":"To zaproszenie obejmuje również dostęp do tych grup:","invite_private":{"title":"Zaproś do dyskusji","email_or_username":"Adres email lub nazwa użytkownika zapraszanej osoby","email_or_username_placeholder":"adres email lub nazwa użytkownika","action":"Zaproś","success":"Wskazany użytkownik został zaproszony do udziału w tej dyskusji.","success_group":"Zaprosiliśmy tą grupę do uczestnictwa w tej wiadomości ","error":"Przepraszamy, wystąpił błąd w trakcie zapraszania użytkownika(-czki).","group_name":"nazwa grupy"},"controls":"Ustawienia tematu","invite_reply":{"title":"Zaproś","username_placeholder":"nazwa użytkownika","action":"Wyślij zaproszenie","help":"zaproś innych do tego tematu e-mailem lub powiadomieniem","to_forum":"Wyślemy krótki email pozwalający twojemu znajomemu błyskawicznie dołączyć przez kliknięcie w link (bez logowania).","sso_enabled":"Podaj nazwę użytkownika lub e-mail osoby którą chcesz zaprosić do tego tematu.","to_topic_blank":"Podaj nazwę użytkownika lub e-mail osoby którą chcesz zaprosić do tego tematu.","to_topic_email":"Wprowadzony został adres e-mail. Wyślemy tam zaproszenie umożliwiające wskazanej osobie odpowiedź w tym temacie.","to_topic_username":"Konto o wprowadzonej nazwie użytkownika otrzyma powiadomienie z linkiem do tego tematu.","to_username":"Podaj nazwę użytkownika osoby którą chcesz zaprosić. Otrzyma powiadomienie z linkiem do tego tematu.","email_placeholder":"nazwa@example.com","success_email":"Wysłaliśmy zaproszenie do \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Otrzymasz powiadomienie, gdy zaproszenie zostanie przyjęte. Sprawdź zakładkę zaproszenia w swoim profilu, aby śledzić status tego i innych zaproszeń.","success_username":"Wskazany użytkownik został zaproszony do udziału w tym temacie.","error":"Przepraszamy, nie udało się zaprosić wskazanej osoby. Być może została już zaproszona? (Lub wysyłasz zbyt wiele zaproszeń)","success_existing_email":"Użytkownik o e-mailu \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e już istnieje. Zaprosiliśmu tego użytkownika do udziału w tym temacie."},"login_reply":"Zaloguj się, aby odpowiedzieć","filters":{"n_posts":{"one":"%{count} wpis","few":"{{count}} wpisy","many":"{{count}} wpisów","other":"{{count}} wpisów"},"cancel":"Usuń filtr"},"move_to":{"title":"Przenieś do","action":"przenieś do","error":"Podczas przenoszenia postów wystąpił błąd."},"split_topic":{"title":"Przenieś do nowego tematu","action":"przenieś do nowego tematu","topic_name":"Nowy tytuł tematu","radio_label":"Nowy temat","error":"Wystąpił błąd podczas przenoszenia wpisów do nowego tematu.","instructions":{"one":"Masz zamiar utworzyć nowy temat, składający się z wybranego przez ciebie wpisu.","few":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów.","many":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów.","other":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów."}},"merge_topic":{"title":"Przenieś do Istniejącego Tematu","action":"przenieś do istniejącego tematu","error":"Wystąpił błąd podczas przenoszenia wpisów do danego tematu.","radio_label":"Istniejący temat","instructions":{"one":"Wybierz temat, do którego chcesz przenieś ten wpis.","few":"Wybierz temat, do którego chcesz przenieść wybrane \u003cb\u003e{{count}}\u003c/b\u003e wpisy.","many":"Wybierz temat, do którego chcesz przenieść \u003cb\u003e{{count}}\u003c/b\u003e wybranych wpisów.","other":"Wybierz temat, do którego chcesz przenieść \u003cb\u003e{{count}}\u003c/b\u003e wybranych wpisów."}},"move_to_new_message":{"title":"Przejdź do nowej wiadomości","action":"przejdź do nowej wiadomości","message_title":"Tytuł nowej wiadomości","radio_label":"Nowa wiadomość","participants":"Uczestnicy","instructions":{"one":"Za chwilę utworzysz nową wiadomość i zapełnisz ją wybranym postem.","few":"Za chwilę utworzysz nową wiadomość i \u003cb\u003ezapełnisz\u003c/b\u003e ją \u003cb\u003ewybranymi\u003c/b\u003e postami \u003cb\u003e{{count}}\u003c/b\u003e .","many":"Za chwilę utworzysz nową wiadomość i \u003cb\u003ezapełnisz\u003c/b\u003e ją \u003cb\u003ewybranymi\u003c/b\u003e postami \u003cb\u003e{{count}}\u003c/b\u003e .","other":"Za chwilę utworzysz nową wiadomość i \u003cb\u003ezapełnisz\u003c/b\u003e ją \u003cb\u003ewybranymi\u003c/b\u003e postami \u003cb\u003e{{count}}\u003c/b\u003e ."}},"move_to_existing_message":{"title":"Przejdź do istniejącej wiadomości","action":"przejdź do istniejącej wiadomości","radio_label":"Istniejąca wiadomość","participants":"Uczestnicy","instructions":{"one":"Wybierz wiadomość, do której chcesz przenieść ten post.","few":"Wybierz wiadomość, do której chcesz przenieść te posty \u003cb\u003e{{count}}\u003c/b\u003e .","many":"Wybierz wiadomość, do której chcesz przenieść te posty \u003cb\u003e{{count}}\u003c/b\u003e .","other":"Wybierz wiadomość, do której chcesz przenieść te posty \u003cb\u003e{{count}}\u003c/b\u003e ."}},"merge_posts":{"title":"Scal wybrane posty","action":"scal wybrane posty","error":"Wystąpił błąd podczas łączenia wybranych postów"},"change_owner":{"title":"Zmiana właściciela","action":"zmień właściciela","error":"Wystąpił błąd podczas zmiany właściciela wpisów.","placeholder":"nazwa nowego właściciela","instructions":{"one":"Wybierz nowego właściciela posta przez \u003cb\u003e@ {{old_user}}\u003c/b\u003e","few":"Wybierz nowego właściciela postów {{count}} autorstwa \u003cb\u003e@ {{old_user}}\u003c/b\u003e","many":"Wybierz nowego właściciela postów {{count}} autorstwa \u003cb\u003e@ {{old_user}}\u003c/b\u003e","other":"Wybierz nowego właściciela postów {{count}} autorstwa \u003cb\u003e@ {{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"zmień znacznik czasu","action":"zmień znacznik czasu","invalid_timestamp":"Znacznik czasu nie może wskazywać na przyszłość.","error":"Wystąpił błąd podczas zmiany znacznika czasu tego tematu.","instructions":"Wybierz nowy znacznik czasu dla tematu. Wpisy w temacie zostaną zaktualizowane o tę samą różnicę."},"multi_select":{"select":"wybierz","selected":"wybrano ({{count}})","select_post":{"label":"wybierz","title":"Dodaj wpis do zaznaczenia"},"selected_post":{"label":"zaznaczone","title":"Kliknij aby usunąć post z zaznaczenia"},"select_replies":{"label":"wybierz +replies","title":"Dodaj post i wszystkie jego odpowiedzi do wyboru"},"select_below":{"label":"wybierz + poniżej","title":"Dodaj post i wszystko po nim do wyboru"},"delete":"usuń wybrane","cancel":"anuluj wybieranie","select_all":"zaznacz wszystkie","deselect_all":"odznacz wszystkie","description":{"one":"Wybrano \u003cb\u003e%{count}\u003c/b\u003e wpis.","few":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisy.","many":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisów.","other":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisów."}}},"post":{"quote_reply":"Cytuj","edit_reason":"Powód","post_number":"wpis {{number}}","ignored":"Zignorowana treść","wiki_last_edited_on":"wiki ostatnio edytowane w","last_edited_on":"ostatnia edycja wpisu","reply_as_new_topic":"Odpowiedz w nowym temacie","reply_as_new_private_message":"Odpowiedź w nowej wiadomości do tego samego odbiorcy","continue_discussion":"Kontynuując dyskusję z {{postLink}}:","follow_quote":"idź do cytowanego wpisu","show_full":"Pokaż pełny wpis","show_hidden":"Wyświetl ignorowaną treść.","deleted_by_author":{"one":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzinę, chyba że zostanie oflagowany) ","few":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godziny, chyba że zostanie oflagowany) ","many":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzin, chyba że zostanie oflagowany) ","other":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzin, chyba że zostanie oflagowany) "},"collapse":"zawalić się","expand_collapse":"rozwiń/zwiń","locked":"członek personelu zablokował edytowanie tego postu","gap":{"one":"pokaż %{count} ukrytą odpowiedź","few":"pokaż {{count}} ukryte odpowiedzi","many":"pokaż {{count}} ukrytych odpowiedzi","other":"pokaż {{count}} ukrytych odpowiedzi"},"notice":{"new_user":"{{user}} opublikował(a) coś po raz pierwszy - powitajmy tę osobę w naszej społeczności!","returning_user":"Minęło trochę czasu, odkąd widzieliśmy {{user}} - jego ostatni post był {{time}}."},"unread":"Nieprzeczytany wpis","has_replies":{"one":"{{count}} odpowiedź","few":"{{count}} odpowiedzi","many":"{{count}} odpowiedzi","other":"{{count}} odpowiedzi"},"has_likes_title":{"one":"%{count} osoba lajkuje ten wpis","few":"{{count}} osoby lajkują ten wpis","many":"{{count}} osób lajkuje ten wpis","other":"{{count}} osób lajkuje ten wpis"},"has_likes_title_only_you":"lajkowany wpis","has_likes_title_you":{"one":"ty i %{count} inna osoba lajkuje ten wpis","few":"ty i {{count}} inne osoby lajkują ten wpis","many":"ty i {{count}} innych osób lajkuje ten wpis","other":"ty i {{count}} innych osób lajkuje ten wpis"},"errors":{"create":"Przepraszamy, podczas tworzenia twojego wpisu wystąpił błąd. Spróbuj ponownie.","edit":"Przepraszamy, podczas edytowania twojego wpisu wystąpił błąd. Spróbuj ponownie.","upload":"Przepraszamy, wystąpił błąd podczas wczytywania Twojego pliku. Proszę, spróbuj ponownie.","too_many_uploads":"Przepraszamy, ale możesz wgrać tylko jeden plik naraz.","upload_not_authorized":"Przepraszamy, plik który próbujesz wgrać jest nie dozwolony (dozwolone rozszerzenia: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Przepraszamy, ale nowi użytkownicy nie mogą wgrywać obrazów.","attachment_upload_not_allowed_for_new_user":"Przepraszamy, ale nowi użytkownicy nie mogą wgrywać załączników.","attachment_download_requires_login":"Przepraszamy, musisz się zalogować, aby pobierać załączniki."},"abandon_edit":{"no_value":"Nie, zatrzymaj","no_save_draft":"Nie, zapisz szkic"},"abandon":{"confirm":"Czy na pewno chcesz porzucić ten wpis?","no_value":"Nie, pozostaw","no_save_draft":"Nie, zapisz szkic","yes_value":"Tak, porzuć"},"via_email":"ten wpis został dodany emailem","via_auto_generated_email":"ten post został dodany poprzez automatycznie wygenerowaną wiadomość e-mail","whisper":"ten wpis jest prywatnym szeptem do moderatorów","wiki":{"about":"ten post jest częścią wiki"},"archetypes":{"save":"Opcje zapisu"},"few_likes_left":"Dziękuję za polubienie! Pozostało Ci tylko parę polubień do wykorzystania dzisiaj","controls":{"reply":"zacznij tworzyć odpowiedź na ten wpis","like":"lajkuj ten wpis","has_liked":"lajkujesz ten wpis","read_indicator":"członkowie, którzy czytają ten post","undo_like":"wycofaj lajka","edit":"edytuj ten wpis","edit_action":"Edytuj","edit_anonymous":"Przykro nam, ale musisz być zalogowany aby edytować ten wpis.","flag":"oflaguj ten wpis lub wyślij powiadomienie o nim do moderatorów","delete":"usuń ten wpis","undelete":"przywróc ten wpis","share":"udostępnij odnośnik do tego wpisu","more":"Więcej","delete_replies":{"direct_replies":{"one":"Tak i bezpośrednia odpowiedź %{count}","few":"Tak i bezpośrednie odpowiedzi {{count}}","many":"Tak i bezpośrednie odpowiedzi {{count}}","other":"Tak i {{count}} bezpośrednich odpowiedzi"},"all_replies":{"one":"Tak i odpowiedź %{count}","few":"Tak i wszystkie odpowiedzi {{count}}","many":"Tak i wszystkie odpowiedzi {{count}}","other":"Tak i wszystkie {{count}} odpowiedzi "},"just_the_post":"Nie, tylko ten post"},"admin":"administracja wpisem (tryb wiki itp)","wiki":"Włącz tryb Wiki","unwiki":"Wyłącz tryb Wiki","convert_to_moderator":"Włącz kolor moderatora","revert_to_regular":"Wyłącz kolor moderatora","rebake":"Odśwież HTML","unhide":"Wycofaj ukrycie","change_owner":"Zmiana właściciela","grant_badge":"Przyznaj odznakę","lock_post":"Zablokuj Wpis","lock_post_description":"nie pozwalaj postującemu edytować tego postu","unlock_post":"Odblokuj Wpis","unlock_post_description":"zezwól postującemu na edycję tego postu","delete_topic_disallowed_modal":"Nie masz uprawnień do usunięcia tego tematu. Jeśli naprawdę chcesz go usunąć, prześlij flagę do moderatora wraz z uzasadnieniem.","delete_topic_disallowed":"nie masz uprawnień do usunięcia tego tematu","delete_topic":"usuń temat","add_post_notice":"Dodaj notatkę personelu"},"actions":{"flag":"Oflaguj","defer_flags":{"one":"Ignoruj flagę","few":"Ignoruj oflagowanie","many":"Ignoruj flagi","other":"Ignoruj flagi"},"undo":{"off_topic":"Cofnij flagę","spam":"Cofnij flagę","inappropriate":"Cofnij flagę","bookmark":"Cofnij zakładkę","like":"Cofnij"},"people":{"off_topic":"Oflagowano jako nie-na-temat","spam":"oznacz jako spam","inappropriate":"Oflagowano jako nieodpowiednie","notify_moderators":"Powiadomiono moderatorów","notify_user":"Wysłano wiadomość","bookmark":"dodaj do zakładek"},"by_you":{"off_topic":"Oznaczono jako nie-na-temat","spam":"Oflagowano jako spam","inappropriate":"Oznaczono jako niewłaściwe","notify_moderators":"Oflagowano do moderacji","notify_user":"Wysłano wiadomość do tego użytkownika","bookmark":"Dodano zakładkę w tym wpisie","like":"Lajkujesz ten wpis"}},"delete":{"confirm":{"one":"Czy na pewno chcesz usunąć ten post?","few":"Czy na pewno chcesz usunąć te {{count}} posty?","many":"Czy na pewno chcesz usunąć te {{count}} postów? ","other":"Czy na pewno chcesz usunąć te {{count}} postów?"}},"merge":{"confirm":{"one":"Czy na pewno chcesz połączyć te posty?","few":"Czy na pewno chcesz połączyć te {{count}} postów?","many":"Czy na pewno chcesz połączyć te {{count}} postów?","other":"Czy na pewno chcesz połączyć te {{count}} postów?"}},"revisions":{"controls":{"first":"Pierwsza wersja","previous":"Poprzednia wersja","next":"Następna wersja","last":"Ostatnia wersja","hide":"Ukryj tę wersję","show":"Pokaż tę wersję","revert":"Przywróć do tej wersji","edit_wiki":"Edytuj Wiki","edit_post":"Edytuj wpis"},"displays":{"inline":{"title":"Pokaż opublikowaną wersję wraz z elementami dodanymi i usuniętymi w treści.","button":"HTML"},"side_by_side":{"title":"Pokaż wersje opublikowane do porównania obok siebie.","button":"HTML"},"side_by_side_markdown":{"title":"Pokaż porównanie źródeł w formie tekstowej obok siebie","button":"Źródło"}}},"raw_email":{"displays":{"raw":{"title":"Pokaż surowy email","button":"Surowy"},"text_part":{"title":"Pokaż część tekstową emaila","button":"Tekst"},"html_part":{"title":"Pokaż część html emaila","button":"HTML"}}},"bookmarks":{"created":"Utworzono","name":"Imię"}},"category":{"can":"może\u0026hellip; ","none":"(brak kategorii)","all":"Wszystkie kategorie","choose":"kategoria\u0026hellip;","edit":"Edytuj","edit_dialog_title":"Edytuj: %{categoryName}","view":"Pokaż Tematy w Kategorii","general":"Ogólne","settings":"Ustawienia","topic_template":"Szablon tematu","tags":"Tagi","tags_allowed_tags":"Zabroń następujących tagów w tej kategorii: ","tags_allowed_tag_groups":"Zabroń następujących grup tagów w tej kategorii:","tags_placeholder":"(Opcjonalnie) lista dozwolonych tagów","tag_groups_placeholder":"(Opcjonalnie) lista dozwolonych grup tagów","allow_global_tags_label":"Zezwól dodatkowo na inne tagi","topic_featured_link_allowed":"Zezwól na wybrane linki w tej kategorii","delete":"Usuń kategorię","create":"Nowa kategoria","create_long":"Utwórz nową kategorię","save":"Zapisz kategorię","slug":"Slug kategorii","slug_placeholder":"(opcjonalne) słowa-z-myślnikiem dla URLi","creation_error":"Podczas tworzenia tej kategorii wystąpił błąd.","save_error":"Podczas zapisywania tej kategorii wystąpił błąd.","name":"Nazwa kategorii","description":"Opis","topic":"temat kategorii","logo":"Grafika z logo kategorii","background_image":"Grafika z tłem kategorii","badge_colors":"Kolor Etykiety","background_color":"Kolor tła","foreground_color":"Kolor Pierwszego Planu","name_placeholder":"Maksymalnie jedno lub dwa słowa","color_placeholder":"Dowolny kolor sieciowy","delete_confirm":"Czy na pewno chcesz usunąć tę kategorię?","delete_error":"Podczas próby usunięcia tej kategorii wystąpił błąd.","list":"Pokaż kategorie","no_description":"Proszę dodaj opis do tej kategorii.","change_in_category_topic":"Edytuj opis","already_used":"Ten kolor jest używany przez inną kategorię","security":"Bezpieczeństwo","special_warning":"Uwaga: Ta kategoria jest generowana automatycznie i jej ustawienia bezpieczeństwa nie mogą być edytowane. Jeśli nie zamierzasz jej używać, skasuj ją, zamiast zmieniać jej przeznaczenie.","uncategorized_security_warning":"Ta kategoria ma specjalny charakter. Jest przeznaczona jako miejsce do przechowywania tematów nie przypisanych do żadnej kategorii i jako taka nie może mieć ustawień bezpieczeństwa.","images":"Obrazy","email_in":"Dedykowany adres email kategorii:","email_in_allow_strangers":"Akceptuj wiadomości email od anonimowych, nieposiadających kont użytkowników ","email_in_disabled":"Tworzenie nowych tematów emailem jest wyłączone w ustawieniach serwisu. ","email_in_disabled_click":"Kliknij tu, aby włączyć.","show_subcategory_list":"Pokaż listę subkategorii powyżej tematów w tej kategorii.","num_featured_topics":"Liczba wątków do wyświetlenia na stronie kategorii:","subcategory_num_featured_topics":"Liczba wątków do wyświetlenia na stronie kategorii:","subcategory_list_style":"Styl listy podkategorii:","sort_order":"Sortuj listę wątków po:","default_view":"Domyślna lista wątków:","default_top_period":"Domyślny okres wyświetlania najlepszych postów:","allow_badges_label":"Włącz przyznawanie odznak na podstawie aktywności w tej kategorii","edit_permissions":"Edytuj uprawnienia","review_group_name":"nazwa grupy","this_year":"ten rok","default_position":"Domyślna pozycja","position_disabled":"Kolejność kategorii będzie uzależniona od aktywności. Aby kontrolować ich kolejność,","position_disabled_click":"włącz statyczną kolejność kategorii","parent":"Kategoria rodzica","num_auto_bump_daily":"Liczba otwartych tematów do automatycznego podbicia każdego dnia","notifications":{"watching":{"title":"Obserwuj wszystko","description":"Będziesz automatycznie śledzić wszystkie tematy w tych kategoriach. Będziesz otrzymywać powiadomienie o każdym nowym wpisie w każdym temacie, a liczba nowych wpisów będzie wyświetlana."},"watching_first_post":{"title":"Oglądasz pierwszy post"},"tracking":{"title":"Śledzona","description":"Będziesz automatycznie śledzić wszystkie nowe tematy w tych kategoriach. Dostaniesz powiadomienie, gdy ktoś ci odpowie lub wspomni twoją @nazwę. Zobaczysz również liczbę odpowiedzi."},"regular":{"title":"Normalny","description":"Otrzymasz powiadomienie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"muted":{"title":"Wyciszone","description":"Nie otrzymasz powiadomień o nowych tematach w tych kategoriach. Nie pojawią się na liście nieprzeczytanych."}},"search_priority":{"options":{"normal":"Normalny","ignore":"Ignoruj","low":"Niski","high":"Wysoki","very_high":"Bardzo wysoki"}},"sort_options":{"default":"domyślny","likes":"Polubienia","op_likes":"Polubienia pierwszego wpisu","views":"Odsłony","posts":"Posty","activity":"Aktywność","posters":"Napisali","category":"Kategoria","created":"Utworzony","votes":"Głosy"},"sort_ascending":"Rosnąco","sort_descending":"Malejąco","subcategory_list_styles":{"rows":"Rzędy","rows_with_featured_topics":"Rzędy z wybranymi tematami","boxes":"Pudełka","boxes_with_featured_topics":"Ramki z wybranymi tematami"},"settings_sections":{"general":"Ogólne","moderation":"Moderacja","email":"Email"}},"flagging":{"title":"Dziękujemy za pomoc w utrzymaniu porządku w naszej społeczności!","action":"Oflaguj wpis","take_action":"Podejmij działanie","notify_action":"Wiadomość","official_warning":"Oficjalne ostrzeżenie","delete_spammer":"Usuń spamera","yes_delete_spammer":"Tak, usuń spamera","ip_address_missing":"(N/D)","hidden_email_address":"(ukryto)","submit_tooltip":"Zapisz prywatną flagę.","take_action_tooltip":"Nie czekaj, aż wpis zostanie zgłoszony przez innych, natychmiast oflaguj do działania . ","cant":"Przepraszamy, nie możesz oflagować teraz tego wpisu.","notify_staff":"Powiadom zespół wiadomością prywatną","formatted_name":{"off_topic":"Jest nie-na-temat","inappropriate":"Jest nieodpowiednie","spam":"Jest odebrane jako spam"},"custom_placeholder_notify_user":"Napisz konkretnie, konstuktywnie i kulturalnie.","custom_placeholder_notify_moderators":"Dlaczego ten wpis wymaga uwagi moderatora? Opisz co konkretnie Cię zaniepokoiło i jeśli to możliwe umieść odpowiednie odnośniki.","custom_message":{"at_least":{"one":"wprowadź co najmniej %{count} znak","few":"wprowadź co najmniej {{count}} znaki","many":"wprowadź co najmniej {{count}} znaków","other":"wprowadź co najmniej {{count}} znaków"},"more":{"one":" pozostał %{count}","few":"pozostały {{count}}","many":"pozostało {{count}}","other":"pozostało {{count}} "},"left":{"one":"%{count} pozostał","few":"{{count}} pozostało","many":"{{count}} pozostało","other":"{{count}} pozostało"}}},"flagging_topic":{"title":"Dziękujemy za pomoc w utrzymaniu porządku w naszej społeczności!","action":"Zgłoś temat","notify_action":"Wiadomość"},"topic_map":{"title":"Podsumowanie tematu","participants_title":"Najczęściej piszą","links_title":"Popularne linki","links_shown":"pokaż więcej linków...","clicks":{"one":"%{count} kliknięcie","few":"%{count} kliknięć","many":"%{count} kliknięć","other":"%{count} kliknięć"}},"post_links":{"about":"rozwiń więcej linków dla tego wpisu","title":{"one":"jeszcze %{count}","few":"%{count} jeszcze","many":"%{count} jeszcze","other":"%{count} jeszcze"}},"topic_statuses":{"warning":{"help":"To jest oficjalne ostrzeżenie."},"bookmarked":{"help":"Temat został dodany do zakładek."},"locked":{"help":"Temat został zamknięty. Dodawanie nowych odpowiedzi nie jest możliwe."},"archived":{"help":"Ten temat został zarchiwizowany i nie można go zmieniać"},"locked_and_archived":{"help":"Ten temat jest zamknięty i zarchiwizowany. Dodawanie odpowiedzi i jego edycja nie są możliwe."},"unpinned":{"title":"Nieprzypięty","help":"Temat nie jest przypięty w ramach twojego konta. Będzie wyświetlany w normalnej kolejności."},"pinned_globally":{"title":"Przypięty globalnie","help":"Ten temat jest przypięty globalnie. Będzie wyświetlany na początku głównej listy oraz swojej kategorii."},"pinned":{"title":"Przypięty","help":"Temat przypięty dla twojego konta. Będzie wyświetlany na początku swojej kategorii."},"unlisted":{"help":"Temat jest niewidoczny: nie będzie wyświetlany na listach tematów a dostęp do niego można uzyskać jedynie poprzez link bezpośredni"}},"posts":"Wpisy","posts_long":"jest {{number}} wpisów w tym temacie","original_post":"Oryginalny wpis","views":"Odsłony","views_lowercase":{"one":"odsłona","few":"odsłony","many":"odsłon","other":"odsłon"},"replies":"Odpowiedzi","views_long":{"one":"ten temat był przeglądany %{count} raz","few":"ten temat był przeglądany {{number}} razy","many":"ten temat był przeglądany {{number}} razy","other":"ten temat był przeglądany {{number}} razy"},"activity":"Aktywność","likes":"Lajki","likes_lowercase":{"one":"lajk","few":"lajki","many":"lajków","other":"lajków"},"likes_long":"jest {{number}} lajków w tym temacie","users":"Użytkownicy","users_lowercase":{"one":"użytkownik","few":"użytkownicy","many":"użytkowników","other":"użytkowników"},"category_title":"Kategoria","history":"Historia","changed_by":"przez {{author}}","raw_email":{"title":"Email przychodzący","not_available":"Niedostępne!"},"categories_list":"Lista Kategorii","filters":{"with_topics":"%{filter} tematy","with_category":"%{filter} tematy w %{category} ","latest":{"title":"Aktualne","title_with_count":{"one":"Aktualne (%{count})","few":"Aktualne ({{count}})","many":"Aktualne ({{count}})","other":"Aktualne ({{count}})"},"help":"tematy z ostatnimi wpisami"},"read":{"title":"Przeczytane","help":"tematy które przeczytałeś, w kolejności od ostatnio przeczytanych"},"categories":{"title":"Kategorie","title_in":"Kategoria - {{categoryName}}","help":"wszystkie tematy zgrupowane przez kategorię"},"unread":{"title":"Nieprzeczytane","title_with_count":{"one":"Nieprzeczytane (%{count})","few":"Nieprzeczytane ({{count}})","many":"Nieprzeczytane ({{count}})","other":"Nieprzeczytane ({{count}})"},"help":"obserwowane lub śledzone tematy z nieprzeczytanymi wpisami","lower_title_with_count":{"one":"%{count} nieprzeczytany","few":"{{count}} nieprzeczytane","many":"{{count}} nieprzeczytanych","other":"{{count}} nieprzeczytanych"}},"new":{"lower_title_with_count":{"one":"%{count} nowa","few":"{{count}} nowe","many":"{{count}} nowych","other":"{{count}} nowych"},"lower_title":"nowe","title":"Nowe","title_with_count":{"one":"Nowe (%{count})","few":"Nowe ({{count}})","many":"Nowe ({{count}})","other":"Nowe ({{count}})"},"help":"tematy dodane w ciągu ostatnich kilku dni"},"posted":{"title":"Wysłane","help":"tematy w których pisałeś"},"bookmarks":{"title":"Zakładki","help":"tematy dodane do zakładek"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"najnowsze tematy w kategorii {{categoryName}}"},"top":{"title":"Popularne","help":"popularne tematy w ubiegłym roku, miesiącu, tygodniu lub dniu","all":{"title":"Cały czas"},"yearly":{"title":"Rocznie"},"quarterly":{"title":"Kwartalnie"},"monthly":{"title":"Miesięcznie"},"weekly":{"title":"Tygodniowo"},"daily":{"title":"Dziennie"},"all_time":"Cały czas","this_year":"Rok","this_quarter":"Kwartał","this_month":"Miesiąc","this_week":"Tydzień","today":"Dzisiaj","other_periods":"zobacz najważniejsze"},"votes":{"title":"Głosy","help":"tematy z największą liczbą głosów"}},"permission_types":{"full":"tworzyć / odpowiadać / przeglądać","create_post":"odpowiadać / przeglądać","readonly":"przeglądać"},"lightbox":{"download":"pobierz","close":"Zamknij (Esc)"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":",","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} lub %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","title":"Skróty klawiszowe","jump_to":{"title":"Skocz do","home":"%{shortcut} Strona główna","latest":"%{shortcut} Najnowsze","new":"%{shortcut} Nowe","unread":"%{shortcut} Nieprzeczytane","categories":"%{shortcut} Kategorie","top":"%{shortcut} Góra","bookmarks":"%{shortcut} Zakładki","profile":"%{shortcut} Profil","messages":"%{shortcut} Wiadomości","drafts":"%{shortcut} szkice"},"navigation":{"title":"Nawigacja","jump":"%{shortcut} idź do postu #","back":"%{shortcut} wstecz","up_down":"%{shortcut} Przesuń zaznaczenie \u0026uarr; \u0026darr;","open":"%{shortcut} Otwórz wybrany temat","next_prev":"%{shortcut} Następna/poprzednia sekcja","go_to_unread_post":"%{shortcut} Idź do pierwszego nieprzeczytanego wpisu"},"application":{"title":"Aplikacja","create":"%{shortcut} utwórz nowy temat","notifications":"%{shortcut} otwarte powiadomienia","hamburger_menu":"%{shortcut} Otwórz menu","user_profile_menu":"%{shortcut} Otwórz menu użytkownika","show_incoming_updated_topics":"%{shortcut} Pokaż zaktualizowane tematy","search":"%{shortcut} Wyszukaj","help":"%{shortcut} Pokaż skróty klawiszowe","dismiss_new_posts":"%{shortcut} wyczyść listę wpisów","dismiss_topics":"%{shortcut} wyczyść listę tematów","log_out":"%{shortcut} Wyloguj"},"composing":{"title":"Komponowanie","return":"%{shortcut} Powróć do kompozytora","fullscreen":"%{shortcut} Pełnoekranowy kompozytor"},"actions":{"title":"Akcje","bookmark_topic":"%{shortcut} dodaj/usuń zakładkę na temat","pin_unpin_topic":"%{shortcut} przypnij/odepnij temat","share_topic":"%{shortcut} Udostępnij temat","share_post":"%{shortcut} Udostępnij post","reply_as_new_topic":"%{shortcut} Odpowiedz w nowym temacie","reply_topic":"%{shortcut} Odpowiedz w temacie","reply_post":"%{shortcut} Odpowiedz na post","quote_post":"%{shortcut} cytuj post","like":"%{shortcut} Lajkuj post","flag":"%{shortcut} Oznacz post","bookmark":"%{shortcut} Dodaj post do zakładek","edit":"%{shortcut} Edytuj post","delete":"%{shortcut} Usuń post","mark_muted":"%{shortcut} Wycisz temat","mark_regular":"%{shortcut} Zwykły (domyślny) temat","mark_tracking":"%{shortcut} śledź temat","mark_watching":"%{shortcut} Obserwuj wątek","print":"%{shortcut} Drukuj temat","defer":"%{shortcut} Odrocz wątek"}},"badges":{"earned_n_times":{"one":"Otrzymano tą odznakę %{count} raz","few":"Otrzymano tą odznakę %{count} razy","many":"Otrzymano tą odznakę %{count} razy","other":"Otrzymano tą odznakę %{count} razy"},"granted_on":"Przyznano %{date}","others_count":"Inni użytkownicy z tą odznaką (%{count})","title":"Odznaki","allow_title":"Możesz użyc tej odznaki jako tytułu","multiple_grant":"Możesz zdobyć tą odznakę wiele razy","badge_count":{"one":"%{count} odznaka","few":"%{count} odznak","many":"%{count} odznak","other":"%{count} odznak"},"more_badges":{"one":"+%{count} więcej","few":"+%{count} więcej","many":"+%{count} więcej","other":"+%{count} więcej"},"granted":{"one":"%{count} przyznany","few":"%{count} przyznanych","many":"%{count} przyznanych","other":"%{count} przyznanych"},"select_badge_for_title":"Wybierz odznakę do użycia jako twój tytuł","none":"(brak)","successfully_granted":"Przyznano %{badge} użytkownikowi %{username}","badge_grouping":{"getting_started":{"name":"Pierwsze kroki"},"community":{"name":"Społeczność"},"trust_level":{"name":"Poziom Zaufania"},"other":{"name":"Inne"},"posting":{"name":"Pisanie"}}},"tagging":{"all_tags":"Wszystkie tagi","other_tags":"Inne tagi","selector_all_tags":"wszystkie tagi","selector_no_tags":"brak tagów","changed":"zmienione tagi:","tags":"Tagi","choose_for_topic":"tagi opcjonalne","add_synonyms":"Dodaj","delete_tag":"Usuń Tag","delete_confirm":{"one":"Czy na pewno chcesz usunąć ten tag i usunąć go z %{count} wątku, do którego jest przypisany?","few":"Czy na pewno chcesz usunąć ten tag i usunąć go z {{count}} wątków, do których jest przypisany?","many":"Czy na pewno chcesz usunąć ten tag i usunąć go z {{count}} wątków, do których jest przypisany?","other":"Czy na pewno chcesz usunąć ten tag i usunąć go z {{count}} wątków, do których jest przypisany?"},"delete_confirm_no_topics":"Czy na pewno chcesz usunąć ten tag?","rename_tag":"Zmień nazwę taga","rename_instructions":"Wybierz nową nazwę dla tego taga:","sort_by":"Sortuj po:","sort_by_count":"Liczba","sort_by_name":"nazwa","manage_groups":"Zarządzaj grupą tagów","manage_groups_description":"Definiowanie grup do organizowania tagów","upload":"Wgraj tagi","upload_description":"Wczytaj plik .csv, by utworzyć wiele tagów naraz","upload_instructions":"Jeden na linię, opcjonalnie z grupą tagu, w formacie \"nazwa_tagu,grupa_tagu\".","upload_successful":"Tagi wgrane ","delete_unused_confirmation":{"one":"%{count} tag zostanie usunięty: %{tags}","few":"%{count} tagi zostaną usunięte: %{tags}","many":"%{count} tagów zostanie usuniętych: %{tags}","other":"%{count} tagów zostanie usuniętych: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} i %{count} więcej","few":"%{tags} i %{count} więcej","many":"%{tags} i %{count} więcej","other":"%{tags} i %{count} więcej"},"delete_unused":"Usuń nieużywane tagi","delete_unused_description":"Usuń wszystkie tagi, które nie są dołączone do żadnych wątków ani wiadomości.","cancel_delete_unused":"Anuluj","filters":{"without_category":"%{filter} %{tag} tematy","with_category":"%{filter} %{tag} tematy w %{category}","untagged_without_category":"%{filter} nieoznaczone tematy","untagged_with_category":"%{filter} nieoznaczone tematy w %{category}"},"notifications":{"watching":{"title":"Obserwowane"},"watching_first_post":{"title":"Oglądasz pierwszy post"},"tracking":{"title":"Śledzenie"},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie, gdy ktoś ci odpowie lub wspomni twoją @nazwę."},"muted":{"title":"Wyciszony"}},"groups":{"title":"Tagi grup","about":"Dodaj etykiety do grup aby zarządzać nimi łatwiej.","new":"Nowa Grupa","tags_label":"Tagi w tej grupie:","tags_placeholder":"tagi","parent_tag_label":"Nadrzędny tag:","parent_tag_placeholder":"Opcjonalnie","parent_tag_description":"Tagi z tej grupy nie mogą być wykorzystane, chyba że główny tag jest obecny.","one_per_topic_label":"Ogranicz jeden tag na temat z tej grupy","new_name":"Nowa grupa tagów","name_placeholder":"Nazwa grupy tagów","save":"Zapisz","delete":"Usuń","confirm_delete":"Czy na pewno chcesz usunąć ten tag grupy?","everyone_can_use":"Tagi mogą być wykorzystywane przez wszystkich","usable_only_by_staff":"Tagi są widoczne dla zespołu, ale jedynie obsługa serwisu może ich używać","visible_only_to_staff":"Tagi są widoczne jedynie dla zespołu"},"topics":{"none":{"unread":"Nie masz nieprzeczytanych tematów.","new":"Nie masz nowych tematów.","read":"Nie przeczytałeś jeszcze żadnych tematów.","posted":"Jeszcze nie zamieściłeś postów w żadnym z tematów.","latest":"Brak najnowszych tematów.","bookmarks":"Nie posiadasz tematów dodanych do zakładek.","top":"Brak najlepszych tematów."},"bottom":{"latest":"Nie ma więcej najnowszych tematów.","posted":"Nie ma więcej tematów, w których pisałeś.","read":"Nie ma więcej przeczytanych tematów.","new":"Nie ma więcej nowych tematów.","unread":"Nie ma więcej nieprzeczytanych tematów.","top":"Nie ma już więcej najlepszych tematów.","bookmarks":"Nie ma więcej dodanych tematów do zakładek."}}},"invite":{"custom_message_placeholder":"Wpisz swoją niestandardową wiadomość","custom_message_template_forum":"Hej, należy dołączyć do tego forum!","custom_message_template_topic":"Hej, pomyślałem że spodoba Ci się ten temat !"},"safe_mode":{"enabled":"Tryb bezpieczny jest włączony, aby z niego wyjść zamknij to okno przeglądrki"},"poll":{"voters":{"one":"głosujący","few":"głosujących","many":"głosujących","other":"głosujących"},"total_votes":{"one":"oddanych głosów","few":"oddanych głosów","many":"oddanych głosów","other":"oddanych głosów"},"average_rating":"Średnia ocena: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Głosy są \u003cstrong\u003ejawne\u003c/strong\u003e."},"results":{"vote":{"title":"Wyniki pojawią się po \u003cstrong\u003ezagłosowaniu\u003c/strong\u003e."},"closed":{"title":"Wyniki pojawią się po \u003cstrong\u003ezamknięciu\u003c/strong\u003e ankiety."},"staff":{"title":"Wyniki pokazywane są wyłącznie członkom \u003cstrong\u003ezespołu\u003c/strong\u003e."}},"multiple":{"help":{"at_least_min_options":{"one":"Wybierz co najmniej \u003cstrong\u003e%{count}\u003c/strong\u003e opcję","few":"Wybierz co najmniej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","many":"Wybierz co najmniej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","other":"Wybierz co najmniej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji"},"up_to_max_options":{"one":"Wybierz co najwyżej \u003cstrong\u003e%{count}\u003c/strong\u003e opcję","few":"Wybierz co najwyżej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","many":"Wybierz co najwyżej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","other":"Wybierz co najwyżej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji"},"x_options":{"one":"Wybierz \u003cstrong\u003e%{count}\u003c/strong\u003e opcję","few":"Wybierz \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","many":"Wybierz \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","other":"Wybierz \u003cstrong\u003e%{count}\u003c/strong\u003e opcji"},"between_min_and_max_options":"Wybierz pomiędzy \u003cstrong\u003e%{min}\u003c/strong\u003e a \u003cstrong\u003e%{max}\u003c/strong\u003e opcjami"}},"cast-votes":{"title":"Oddaj głos","label":"Oddaj głos!"},"show-results":{"title":"Wyświetl wyniki ankiety","label":"Pokaż wyniki"},"hide-results":{"title":"Wróć do oddanych głosów","label":"Pokaż głos"},"group-results":{"title":"Grupuj głosy polami użytkownika","label":"Pokaż podsumowanie"},"ungroup-results":{"title":"Połącz wszystkie głosy","label":"Ukryj podsumowanie"},"export-results":{"title":"Eksportuj wyniki ankiety","label":"Eksport"},"open":{"title":"Otwórz ankietę","label":"Otwórz","confirm":"Czy na pewno chcesz otworzyć tę ankietę?"},"close":{"title":"Zamknij ankietę","label":"Zamknij","confirm":"Czy na pewno chcesz zamknąć tę ankietę?"},"automatic_close":{"closes_in":"Zamknięcie ankiety w ciągu \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Zamknięta \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Przepraszamy, wystąpił błąd podczas przełączania statusu w tej ankiecie.","error_while_casting_votes":"Przepraszamy, wystąpił błąd podczas oddawania głosów.","error_while_fetching_voters":"Przepraszamy, wystąpił błąd podczas wyświetlania głosujących.","error_while_exporting_results":"Przepraszamy, wystąpił błąd poczas eksportowania wyników ankiety.","ui_builder":{"title":"Utwórz ankietę","insert":"Wstaw ankietę","help":{"invalid_values":"Wartość minimalna musi być mniejsza niż maksymalna.","min_step_value":"Minimalna wartość kroku to 1"},"poll_type":{"label":"Typ","regular":"Pojedynczy wybór","multiple":"Wielokrotny wybór","number":"Liczba ocen"},"poll_result":{"label":"Wyniki","always":"Zawsze widoczna","vote":"Po zagłosowaniu","closed":"Po zamknięciu","staff":"Wyłącznie dla zespołu"},"poll_chart_type":{"label":"Typ wykresu"},"poll_config":{"max":"Max","min":"Min","step":"Krok"},"poll_public":{"label":"Pokaż kto głosował"},"poll_options":{"label":"Wprowadź jedną opcję ankiety w jednej linii"},"automatic_close":{"label":"Automatycznie zamknij ankietę"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Rozpocznij poradnik nowego użytkownika dla wszystkich nowych użytkowników","welcome_message":"Wyślij wszystkim nowym użytkownikom wiadomość powitalną z szybkim przewodnikiem"}},"discourse_local_dates":{"relative_dates":{"today":"Dziś %{time}","tomorrow":"Jutro %{time}","yesterday":"Wczoraj %{time}","countdown":{"passed":"data minęła"}},"title":"Wprowadź datę / czas","create":{"form":{"insert":"Wstaw","advanced_mode":"Tryb zaawansowany","simple_mode":"Tryb prosty","format_description":"Format używany do wyświetlenia daty użytkownikowi. Użyj \"\\T\\Z\", by wyświetlić strefę czasową użytkownika słowami (Europa/Paryż)","timezones_title":"Strefy czasowe do wyświetlenia","timezones_description":"Strefy czasowe zostaną użyte do wyświetlenia dat w podglądzie i fallbacku","recurring_title":"Powtarzanie","recurring_description":"Ustaw powtarzanie wydarzenia. Możesz też manualnie edytować opcję powtarzania generowaną przez formularz przy użyciu jednej z poniższych formuł: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"Brak powtarzania","invalid_date":"Niewłaściwa data, sprawdź, czy poprawnie ustawiono datę i czas","date_title":"Data","time_title":"Czas","format_title":"Format daty","timezone":"Strefa czasowa","until":"Do…","recurring":{"every_day":"Codziennie","every_week":"Co tydzień","every_two_weeks":"Co dwa tygodnie","every_month":"Co miesiąc","every_two_months":"Co dwa miesiące","every_three_months":"Co trzy miesiące","every_six_months":"Co sześć miesięcy","every_year":"Co roku"}}}},"details":{"title":"Ukryj szczegóły"},"presence":{"replying":"odpowiada","editing":"edytuje","replying_to_topic":{"one":"odpowiada","few":"odpowiadają","many":"odpowiadają","other":"odpowiadają"}},"voting":{"title":"Głosowanie","reached_limit":"Oddałeś już maksymalną liczbę głosów!","list_votes":"Lista twoich głosów","votes_nav_help":"tematy z największą liczbą głosów","voted":"Oddałeś już głos","allow_topic_voting":"Pozwól użytkownikom głosować na tematy w tej kategorii","vote_title":"Głosuj","vote_title_plural":"Głosuj","voted_title":"Głosów","voting_closed_title":"Zamknięto","voting_limit":"Limit","votes_left":{"one":"Pozostał Ci {{count}} głos, zobacz \u003ca href='{{path}}'\u003eswoje głosy\u003c/a\u003e.","few":"Pozostały Ci {{count}} głosy, zobacz \u003ca href='{{path}}'\u003eswoje głosy\u003c/a\u003e.","many":"Pozostało Ci {{count}} głosów, zobacz \u003ca href='{{path}}'\u003eswoje głosy\u003c/a\u003e.","other":"Pozostało Ci {{count}} głosów, zobacz \u003ca href='{{path}}'\u003eswoje głosy\u003c/a\u003e."},"votes":{"one":"{{count}}głos","few":"{{count}}głosy","many":"{{count}}głosów","other":"{{count}}głosów"},"anonymous_button":{"one":"Głos","few":"Głosy","many":"Głosów","other":"Głosów"},"remove_vote":"Usuń głos"},"adplugin":{"advertisement_label":"OGŁOSZENIE"},"docker":{"upgrade":"Twoja instancja Discourse wymaga aktualizacji. ","perform_upgrade":"Kliknij tu, aby zaktualizować."}}},"zh_CN":{"js":{"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","reminders":{"today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"user":{"second_factor":{"extended_description":"双重验证要求你的密码之外的一次性令牌，从而为你的账户增加了额外的安全性。可以在\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e和\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e设备上生成令牌。\n"}},"topic":{"topic_status_update":{"private_timer_types":"用户主题计时器"},"auto_bump":{"title":"自动顶帖"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","yes_value":"是的，忽略编辑"},"controls":{"delete_replies":{"confirm":"你也想删除该贴的回复？"},"remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"like_capped":{"other":"和其他 {{count}} 人赞了它"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","manage_tag_groups_link":"管理这里的标签组。","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","all_topics_wiki":"默认将新主题设为维基主题","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","require_topic_approval":"所有新主题需要版主审批","require_reply_approval":"所有新回复需要版主审批","position":"分类页面位置：","minimum_required_tags":"在一个主题中至少含有多少个标签：","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"}},"search_priority":{"label":"搜索优先级","options":{"very_low":"非常低"}},"settings_sections":{"appearance":"主题"}},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"notifications":{"watching":{"description":"你将自动监看所有含有此标签的主题。你将收到所有新帖子和主题的通知，此外，主题旁边还会显示未读和新帖子的数量。"},"watching_first_post":{"description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"},"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"}},"ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_groups":{"label":"允许的群组"}}}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"controls":{"publish_page":"Page Publishing"},"actions":{"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'pl_PL';
I18n.pluralizationRules.pl_PL = MessageFormat.locale.pl_PL;
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


    var monthsNominative = 'styczeń_luty_marzec_kwiecień_maj_czerwiec_lipiec_sierpień_wrzesień_październik_listopad_grudzień'.split('_'),
        monthsSubjective = 'stycznia_lutego_marca_kwietnia_maja_czerwca_lipca_sierpnia_września_października_listopada_grudnia'.split('_');
    function plural(n) {
        return (n % 10 < 5) && (n % 10 > 1) && ((~~(n / 10) % 10) !== 1);
    }
    function translate(number, withoutSuffix, key) {
        var result = number + ' ';
        switch (key) {
            case 'ss':
                return result + (plural(number) ? 'sekundy' : 'sekund');
            case 'm':
                return withoutSuffix ? 'minuta' : 'minutę';
            case 'mm':
                return result + (plural(number) ? 'minuty' : 'minut');
            case 'h':
                return withoutSuffix  ? 'godzina'  : 'godzinę';
            case 'hh':
                return result + (plural(number) ? 'godziny' : 'godzin');
            case 'MM':
                return result + (plural(number) ? 'miesiące' : 'miesięcy');
            case 'yy':
                return result + (plural(number) ? 'lata' : 'lat');
        }
    }

    var pl = moment.defineLocale('pl', {
        months : function (momentToFormat, format) {
            if (!momentToFormat) {
                return monthsNominative;
            } else if (format === '') {
                // Hack: if format empty we know this is used to generate
                // RegExp by moment. Give then back both valid forms of months
                // in RegExp ready format.
                return '(' + monthsSubjective[momentToFormat.month()] + '|' + monthsNominative[momentToFormat.month()] + ')';
            } else if (/D MMMM/.test(format)) {
                return monthsSubjective[momentToFormat.month()];
            } else {
                return monthsNominative[momentToFormat.month()];
            }
        },
        monthsShort : 'sty_lut_mar_kwi_maj_cze_lip_sie_wrz_paź_lis_gru'.split('_'),
        weekdays : 'niedziela_poniedziałek_wtorek_środa_czwartek_piątek_sobota'.split('_'),
        weekdaysShort : 'ndz_pon_wt_śr_czw_pt_sob'.split('_'),
        weekdaysMin : 'Nd_Pn_Wt_Śr_Cz_Pt_So'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Dziś o] LT',
            nextDay: '[Jutro o] LT',
            nextWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[W niedzielę o] LT';

                    case 2:
                        return '[We wtorek o] LT';

                    case 3:
                        return '[W środę o] LT';

                    case 6:
                        return '[W sobotę o] LT';

                    default:
                        return '[W] dddd [o] LT';
                }
            },
            lastDay: '[Wczoraj o] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[W zeszłą niedzielę o] LT';
                    case 3:
                        return '[W zeszłą środę o] LT';
                    case 6:
                        return '[W zeszłą sobotę o] LT';
                    default:
                        return '[W zeszły] dddd [o] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'za %s',
            past : '%s temu',
            s : 'kilka sekund',
            ss : translate,
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : '1 dzień',
            dd : '%d dni',
            M : 'miesiąc',
            MM : translate,
            y : 'rok',
            yy : translate
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return pl;

})));

// moment-timezone-localization for lang code: pl

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidżan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Akra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algier","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangi","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Bandżul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bużumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Kair","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Konakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Dżibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Duala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Al-Ujun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Dżuba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Chartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinszasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadiszu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndżamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nawakszut","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Wagadugu","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Trypolis","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhuk","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Salvador","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belém","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Kajenna","id":"America/Cayenne"},{"value":"America/Cayman","name":"Kajmany","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Kostaryka","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominika","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Salwador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Gwadelupa","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Gwatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Gujana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Hawana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamajka","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martynika","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Meksyk (miasto)","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"Nowy Jork","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Dakota Północna","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Dakota Północna","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Dakota Północna","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port-of-Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Portoryko","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Sao Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint-Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Saint Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Saint Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Saint Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Saint Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Qaanaaq","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Wostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Ałmaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktiubińsk","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Aszchabad","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrajn","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnauł","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Bejrut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Biszkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kalkuta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Czyta","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Czojbalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Kolombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damaszek","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dhaka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubaj","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Duszanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hongkong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Kobdo","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkuck","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Dżakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerozolima","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamczatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karaczi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Chandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwejt","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Makau","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Maskat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nikozja","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Nowokuźnieck","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Nowosybirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Uralsk","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pjongjang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Katar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kyzyłorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangun","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Rijad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Chi Minh","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sachalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkanda","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Szanghaj","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapur","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Sriedniekołymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Tajpej","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taszkient","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ułan Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumczi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Niera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Wientian","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Władywostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakuck","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterynburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Erywań","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azory","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermudy","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Wyspy Kanaryjskie","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Republika Zielonego Przylądka","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Wyspy Owcze","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madera","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Georgia Południowa","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Święta Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"uniwersalny czas koordynowany","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andora","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrachań","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Ateny","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrad","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratysława","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bruksela","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukareszt","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapeszt","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Büsingen am Hochrhein","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Kiszyniów","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kopenhaga","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Irlandia (czas letni)Dublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Wyspa Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Stambuł","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kijów","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirow","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lizbona","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Lublana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Brytyjski czas letniLondyn","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luksemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madryt","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Maarianhamina","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Mińsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monako","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskwa","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paryż","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praga","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Ryga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rzym","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajewo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratów","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Symferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Sztokholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallin","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uljanowsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Użgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Watykan","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Wiedeń","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Wilno","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Wołgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Warszawa","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagrzeb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporoże","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zurych","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarywa","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Czagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Wyspa Bożego Narodzenia","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Wyspy Kokosowe","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Komory","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Wyspy Kerguelena","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Malediwy","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Majotta","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Wyspa Bougainville’a","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Wyspa Wielkanocna","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fidżi","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Wyspy Gambiera","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Markizy","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Numea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
